# 30 · Phase 2 Completion Summary

**Doc ID:** `verifiq-phase2-completion-v0.1`
**Phase:** 2 — The six MVP Council agents + self-check protocol (per `docs/28` Phase 2 kickoff / file 16 § Phase 3)
**Date:** 2026-06-06
**Author:** Claude Code (build), for Liam Doolan (founder) sign-off

---

## What was built

The six MVP agents, in `src/agents/`, built on the Phase 1 LLM adapter. Prompts
are **loaded from `verifiq-prompts/`** at runtime (never inlined — CLAUDE.md
anti-pattern).

- **`prompts.ts`** — `PromptLoader` reads file 01 (master), file 04 (discipline
  sections), file 07 (council), file 13 (self-check) from disk and assembles the
  layered system prompt. `extractSection()` pulls a numbered section by heading.
- **`self-check.ts`** — `runSelfCheck()` implements the 7 pre-emit checks from
  file 13 (source quote → discipline → stage → context → consequence → evidence
  → owner) and emits the file-13 audit entry shape (the lessons-learnt training
  signal). Hard checks suppress; stage-inappropriateness downgrades the impact.
  Strict Check 1 verifies the source quote actually appears in the document text.
- **`parse.ts`** — turns an LLM response into well-formed §05.1 Findings,
  validating against the controlled vocabularies; malformed candidates are
  collected with a reason rather than emitted.
- **`disciplines.ts`** — the five MVP discipline definitions: Architect (04.1),
  Fire (04.2), Access/DAC (04.3), M&E (04.4 + 04.5 combined), QS (04.9), each
  with finding-id prefix, discipline-match tokens, and a semver prompt version.
- **`agent.ts`** — `DisciplineAgent`: assembles the prompt, calls the adapter
  ("discipline-primary-review"), parses, runs each candidate through the
  self-check gate, assigns `{prefix}-{stage}-{seq}` issue ids, and emits only
  passing findings — logging every self-check decision to the injected sink.
- **`chair.ts`** — `ChairAgent`: consolidates findings into the §05.3 Build
  Readiness Report. The rating↔decision mapping (file 06) is **derived in code**
  (`deriveDecision()`) so the invariant cannot be violated; the LLM
  ("council-chair") supplies only narrative prose. The report always carries the
  locked disclaimer (file 08).
- **`index.ts`** — barrel + `createMvpDisciplineAgents()`.

---

## Definition of Done — status (file 16 § Phase 3)

| DoD item | Status | Notes |
|---|---|---|
| Six MVP agents built | ✅ | 5 discipline agents + Chair |
| Each agent loads master + self-check + discipline prompt | ✅ | From `verifiq-prompts/` via `PromptLoader` |
| 7 self-check questions as a pre-emit validator | ✅ | `runSelfCheck()`; the 7 file-13 checks |
| Validator rejects findings missing source quotes | ✅ | Check 1 (verbatim against source text); covered by test |
| Returns Finding objects conforming to §05.1 | ✅ | `parse.ts` enforces the schema/vocabularies |
| Logs every self-check decision to audit_log | ✅ (sink) | Decisions go to the injected `SelfCheckSink`; the production sink calls `appendAudit` (open item below) |
| `tsc --noEmit` zero errors | ✅ | Verified |
| Lint clean | ✅ | Verified |
| Tests pass | ✅ | 9/9 (5 Phase 2 + 4 Phase 1) |
| Workflow orchestrator NOT started | ✅ | Out of scope (Phase 3) |

Verified in this environment: `npm run typecheck`, `npm run lint`, `npm test`
(9/9) all pass.

---

## Deviations / decisions

1. **Agents are plain modules, not Convex actions.** Same decoupling pattern as
   the Phase 1 adapter — they take documents + context and return findings, with
   an injected audit sink. Wiring them into Convex actions + the job queue is the
   Phase 3 orchestrator. This keeps them unit-testable without a deployment.
2. **Prompts loaded via `node:fs`.** Honours "no inlined prompts". A Convex
   deployment can't read arbitrary repo files at runtime, so the Phase 3
   orchestrator will need a build step that bundles the prompt files (or loads
   them through a Convex-hosted corpus). Flagged for Phase 3.
3. **Chair decision derived in code.** The LLM writes prose only; the
   rating/decision come from `deriveDecision()` so the file-06 invariant is
   guaranteed. "Grey / Insufficient information" is driven by a
   `coreDocumentsMissing` flag the caller supplies.
4. **Self-check judgement checks are partial by design.** Mechanical checks
   (source quote present + verbatim, discipline, consequence, evidence, owner)
   are fully enforced. Project-context override (Check 4) runs against a caller-
   supplied `alreadyAddressed` list; richer planning-grant/alternative-compliance
   reasoning (REJ-09/REJ-10) grows via the lessons-learnt loop (file 15).

---

## Open questions for Phase 3 (workflow orchestrator)

1. **Production audit sink.** Provide a Convex-action-side `SelfCheckSink` that
   calls `appendAudit`, so every self-check decision persists to `audit_log`
   exactly as file 13 specifies.
2. **Prompt bundling for Convex runtime** (deviation 2).
3. **Peer challenge + adjudication** (file 07.1/07.2, file 06 escalation rules)
   feed the Chair — these are Phase 3 of the issuance plan, deliberately not built.
4. **Cross-reference protocol** (file 19) for interface findings.
5. **Document extraction** — agents currently take pre-extracted text; PDF/
   title-block extraction is platform mandatory #3 (file 20 §3).

---

## Estimated Phase 3 readiness

**Ready.** The agents, self-check gate, finding parser, and Chair report
generator are in place and tested. Phase 3 wires them into the resumable
job-queue workflow (intake → classify → review → challenge → adjudicate → chair)
defined in `verifiq-prompts/03_review_workflow.md` + file 20 §2.

Live-credential checks (real LLM calls behind the agents) remain "verify
locally" — provide `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` and run an agent
against a sample document.
