/**
 * VerifIQ — procurement pack-completeness tests (proof of concept).
 *
 * Proves the engine reproduces the HSE SAQ review's headline gaps for the QW1
 * Restricted (Works + PSCS) reference pack, deterministically, and emits
 * schema-conformant §05.1 Findings.
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import { checkPackCompleteness, EXPECTED_PACK_MATRIX } from "../src/procurement/index.js";

const QW1 = "QW1-restricted-works-pscs";

describe("Procurement pack-completeness checker", () => {
  it("flags the SAQ review's known gaps (Appendix B1 + the 3.4a/3.4b CV pro-formas)", () => {
    // A pack with the 6 baseline docs only — what the router guarantees today.
    const baseline = [
      "cwmf_qw1_part1",
      "cwmf_qw_part2",
      "cwmf_appendix_a",
      "cwmf_appendix_d1",
      "cwmf_hs_3_4_1",
      "cwmf_hs_3_4_2",
    ];
    const { findings, missing } = checkPackCompleteness({
      scenarioId: QW1,
      presentDocCodes: baseline,
    });

    expect(missing).toContain("cwmf_appendix_b1");
    expect(missing).toContain("cwmf_appendix_cv_3_4a");
    expect(missing).toContain("cwmf_appendix_cv_3_4b");

    // The CV pro-formas must be flagged as buyer-issued blanks.
    const cv = findings.find((f) => f.source_reference === "cwmf_appendix_cv_3_4a");
    expect(cv?.finding).toMatch(/buyer-issued pro-forma/);
    expect(cv?.risk).toBe("Critical");
    expect(cv?.owner).toBe("Contracting Authority");
    expect(cv?.status).toBe("Not demonstrated");
    expect(cv?.discipline_origin).toBe("Procurement / Tender Pack");
  });

  it("does not demand conditional docs unless their option is selected", () => {
    const full = [
      "cwmf_qw1_part1",
      "cwmf_qw_part2",
      "cwmf_appendix_a",
      "cwmf_appendix_b1",
      "cwmf_appendix_d1",
      "cwmf_hs_3_4_1",
      "cwmf_hs_3_4_2",
      "cwmf_appendix_cv_3_4a",
      "cwmf_appendix_cv_3_4b",
    ];
    // Without selecting comparable_projects, B2 is not required → complete.
    expect(checkPackCompleteness({ scenarioId: QW1, presentDocCodes: full }).missing).toHaveLength(0);

    // Selecting comparable_projects makes B2 required.
    const withOpt = checkPackCompleteness({
      scenarioId: QW1,
      presentDocCodes: full,
      selectedOptions: ["comparable_projects"],
    });
    expect(withOpt.missing).toEqual(["cwmf_appendix_b2"]);
  });

  it("matrix integrity: every required doc has a code, title and risk", () => {
    for (const scenario of Object.values(EXPECTED_PACK_MATRIX)) {
      for (const doc of scenario.requires) {
        expect(doc.code).toMatch(/\S/);
        expect(doc.title).toMatch(/\S/);
        expect(["Critical", "High", "Medium", "Low", "Advisory"]).toContain(doc.riskIfMissing);
        if (doc.criticality === "conditional") expect(doc.condition).toBeTruthy();
      }
    }
  });

  it("throws on an unknown scenario", () => {
    expect(() => checkPackCompleteness({ scenarioId: "nope", presentDocCodes: [] })).toThrow(
      /Unknown pack scenario/,
    );
  });
});
