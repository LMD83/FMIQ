/**
 * VerifIQ — Phase 5 tests (prompt bundling + review dispatch data layer).
 *
 *  - bundledPromptLoader serves the layered prompts from the build-time bundle
 *    with no filesystem access (so the agents work in the Convex runtime).
 *  - requestReview persists a RunInput and loadReviewInput reads it back; a
 *    project left in a non-terminal scan state is picked up by resumeStalled.
 *
 * The runReview node action itself is deploy-time glue (needs keys + a Convex
 * deployment) and is not exercised here.
 */

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import { bundledPromptLoader } from "../src/agents";

const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "../src/convex/**/*.js",
  "!../src/convex/**/*.d.ts",
]);

describe("Phase 5 — prompt bundling", () => {
  it("serves layered prompts from the bundle without filesystem access", async () => {
    const prompts = bundledPromptLoader();
    expect(await prompts.master()).toContain("VerifIQ");
    expect(await prompts.selfCheck()).toContain("Source quote present");
    expect(await prompts.disciplineSection("04.1")).toContain("Architect Agent");
    expect(await prompts.disciplineSection("04.9")).toContain("Quantity Surveyor Agent");
    expect(await prompts.councilSection("07.3")).toContain("Chair Agent");
  });
});

describe("Phase 5 — review dispatch", () => {
  it("persists a RunInput and resumes an in-flight scan", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.mutations.createUser, { email: "liam@goviq.ie" });
    const projectId = await t.mutation(api.mutations.createProject, {
      owner_user_id: userId,
      name: "Dispatch Test",
    });

    const payload = JSON.stringify({
      projectId,
      projectName: "Dispatch Test",
      projectStage: "pre-tender",
      buildingType: "office",
      reviewDate: "2026-06-06",
      documentsByDiscipline: { architect: [{ filename: "A-100.pdf", text: "..." }] },
    });

    await t.mutation(api.reviewData.requestReview, { project_id: projectId, payload_json: payload });

    const loaded = await t.query(internal.reviewData.loadReviewInput, { project_id: projectId });
    expect(loaded).toBe(payload);

    // Move into a non-terminal scan state, then the resume tick re-dispatches it.
    await t.mutation(api.jobs.advanceScanState, { project_id: projectId, scan_state: "scanning" });
    const resumed = await t.mutation(internal.reviewData.resumeStalled, {});
    expect(resumed).toBeGreaterThanOrEqual(1);
  });
});
