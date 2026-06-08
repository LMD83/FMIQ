/**
 * VerifIQ — Phase 1 end-to-end smoke test (docs/28 § Deliverable 5).
 *
 * Proves the foundation works before complexity is added:
 *  1. create a project via the schema
 *  2. add a document record
 *  3. call the LLM adapter with a trivial prompt ("respond with 'OK'")
 *  4. insert a finding and read it back
 *  5. assert the audit_log entry was written
 *
 * Plus two Definition-of-Done checks that run without live credentials:
 *  - the adapter fails over to the fallback provider on a forced-fail scenario
 *  - the R2 adapter generates a working signed upload URL (presigned offline)
 *
 * The LLM providers are stubbed so the test is deterministic and needs no API
 * keys; the live-credential checks (real Anthropic call, real R2 round-trip,
 * `npx convex dev` deploy) are listed in docs/29 as "verify locally".
 */

/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { createLLM } from "../src/llm";
import {
  type AuditSink,
  type LLMProvider,
  type LLMResult,
  type LLMRole,
  type ProviderName,
  RetryableLLMError,
} from "../src/llm/types";
import { R2Provider } from "../src/storage/r2";
import { StorageRouter } from "../src/storage";

// convex-test discovers the function modules under src/convex (the test is not
// colocated, so the glob is passed explicitly).
const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "../src/convex/**/*.js",
  "!../src/convex/**/*.d.ts",
]);

/** Minimal LLM provider stub. */
class StubProvider implements LLMProvider {
  constructor(
    readonly name: ProviderName,
    private readonly behaviour: "ok" | "retryable",
  ) {}

  async complete(_role: LLMRole, _prompt: string): Promise<LLMResult> {
    if (this.behaviour === "retryable") {
      throw new RetryableLLMError("forced failure", this.name);
    }
    return {
      text: "OK",
      tokens_in: 6,
      tokens_out: 1,
      model_used: `${this.name}-stub`,
      provider_used: this.name,
      cost_eur: 0,
      latency_ms: 1,
    };
  }

  async completeVision(): Promise<LLMResult> {
    return this.complete("classification", "");
  }

  getCost(): number {
    return 0;
  }
}

describe("VerifIQ Phase 1 smoke", () => {
  it("runs project → document → LLM → finding → audit end-to-end", async () => {
    const t = convexTest(schema, modules);

    // 1. project (via a stub user)
    const userId = await t.mutation(api.mutations.createUser, {
      email: "liam@goviq.ie",
      role: "admin",
    });
    const projectId = await t.mutation(api.mutations.createProject, {
      owner_user_id: userId,
      name: "Smoke Test Project",
      building_type: "office",
      stage: "pre-tender",
    });

    // 2. document record (file lives in R2 — r2_key only)
    const docId = await t.mutation(api.mutations.addDocument, {
      project_id: projectId,
      filename: "A-100 Rev B.pdf",
      sha256: "a".repeat(64),
      size_bytes: 1_234_567,
      r2_key: `proj/${projectId}/disc/architectural/${"a".repeat(64)}.pdf`,
      discipline: "architectural",
    });
    expect(docId).toBeTruthy();

    // 3. LLM call (audit sink writes each call to audit_log via a mutation)
    const audit: AuditSink = async (entry) => {
      await t.mutation(api.mutations.appendAudit, {
        project_id: projectId,
        actor: "system",
        action: entry.action,
        target_type: "llm",
        target_id: entry.role,
        payload_json: JSON.stringify(entry),
      });
    };
    const llm = createLLM({ providers: { anthropic: new StubProvider("anthropic", "ok") }, audit });
    const result = await llm.complete("classification", "respond with the word 'OK'");
    expect(result.text).toBe("OK");
    expect(result.provider_used).toBe("anthropic");

    // 4. finding insert + read back
    await t.mutation(api.mutations.insertFinding, {
      project_id: projectId,
      issue_id: "ARCH-PRE-0001",
      discipline_origin: "architectural",
      stage: "pre-tender",
      source_document: "A-100 Rev B.pdf",
      source_reference: "Title block, sheet A-100",
      requirement: "Drawing register must list the current revision.",
      finding: "Sheet A-100 is shown at Rev B; the register lists Rev A.",
      status: "Coordination issue",
      risk: "Medium",
      build_readiness_impact: "Pre-tender close-out",
      owner: "Lead Designer",
      model_used: result.model_used,
    });
    const readBack = await t.query(api.mutations.getFindingByIssue, {
      project_id: projectId,
      issue_id: "ARCH-PRE-0001",
    });
    expect(readBack?.finding).toContain("Rev B");
    expect(readBack?.risk).toBe("Medium");

    // 5. audit_log was written (the LLM call logged at least one entry)
    const audited = await t.query(api.mutations.listAudit, { project_id: projectId });
    expect(audited.length).toBeGreaterThanOrEqual(1);
    expect(audited.some((a: { action: string }) => a.action === "llm_call")).toBe(true);
  });

  it("fails over to the fallback provider on a forced-fail scenario", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.mutations.createUser, { email: "f@goviq.ie" });
    const projectId = await t.mutation(api.mutations.createProject, {
      owner_user_id: userId,
      name: "Failover Project",
    });

    const events: string[] = [];
    const audit: AuditSink = async (entry) => {
      events.push(entry.action);
      await t.mutation(api.mutations.appendAudit, {
        project_id: projectId,
        actor: "system",
        action: entry.action,
        target_type: "llm",
        payload_json: JSON.stringify(entry),
      });
    };

    // classification chain is [anthropic, openai]; force anthropic to fail.
    const llm = createLLM({
      providers: {
        anthropic: new StubProvider("anthropic", "retryable"),
        openai: new StubProvider("openai", "ok"),
      },
      audit,
    });
    const result = await llm.complete("classification", "respond with 'OK'");
    expect(result.provider_used).toBe("openai");
    expect(events).toContain("llm_failover");
    expect(events).toContain("llm_call");
  });

  it("generates a working R2 signed upload URL (offline presign)", async () => {
    const r2 = new R2Provider({
      accountId: "test-account",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "verifiq-prod-eu-west",
    });
    const target = await r2.getUploadUrl({
      project_id: "p1",
      discipline: "architectural",
      filename: "A-100.pdf",
      sha256: "b".repeat(64),
      size_bytes: 2_000_000,
    });
    expect(target.method).toBe("PUT");
    expect(target.url).toMatch(/^https:\/\//);
    expect(target.url).toContain("X-Amz-Signature");
    expect(target.key).toContain("proj/p1/disc/architectural/");
  });

  it("routes large files to R2 by size", () => {
    const r2 = new R2Provider({
      accountId: "a",
      accessKeyId: "k",
      secretAccessKey: "s",
      bucket: "b",
    });
    const router = new StorageRouter({ r2, thresholdBytes: 100 * 1024 * 1024 });
    expect(router.forUpload(150 * 1024 * 1024).name).toBe("r2");
  });
});
