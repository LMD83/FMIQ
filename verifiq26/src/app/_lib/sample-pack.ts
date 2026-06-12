/**
 * Shared sample pack — the same anonymised, planted-issue Stage 2C tender pack
 * that `scripts/run-review.mjs` dispatches. The app's "Run sample review" button
 * sends this to `reviewData.requestReview` so the slice proves the council
 * end-to-end without a real upload. Keep in step with run-review.mjs.
 *
 * Illustrative only. Output is indicative; the reviewer verifies locally.
 */

export type SampleDoc = { filename: string; text: string };

export type SamplePack = {
  projectName: string;
  projectStage: string;
  buildingType: string;
  reviewDate: string;
  corpusVersion: string;
  reviewerInitials: string;
  projectContext: string;
  documentsByDiscipline: Record<string, SampleDoc[]>;
};

export function buildSamplePack(): SamplePack {
  return {
    projectName: "Demo · Adult Day Service (Stage 2C)",
    projectStage: "pre-tender",
    buildingType: "Adult Day Service",
    reviewDate: new Date().toISOString().slice(0, 10),
    corpusVersion: "IE-2026.06",
    reviewerInitials: "LD",
    projectContext:
      "Anonymised Stage 2C tender pack. Public-sector Adult Day Service, Dublin. " +
      "Procured under CWMF using PW-CF5 (Employer-Designed). FSC granted; BCAR applies.",
    documentsByDiscipline: {
      architect: [
        {
          filename: "Architectural Works Specification.txt",
          text: [
            "SECTION K10 — DRY LINING / PARTITIONS",
            "Wall Types 1-4: proprietary metal-stud partitions. Fire resistance of complete",
            "partition assembly: REI 30 or better to BS EN 13501-2. No compartment wall type",
            "is scheduled.",
            "",
            "PRELIMINARIES: VAT to be applied at 21%.",
            "Cover page: 'Proposed School, Co. Mayo' (project is an Adult Day Service in Dublin).",
          ].join("\n"),
        },
      ],
      fire: [
        {
          filename: "Fire Safety Strategy.txt",
          text: [
            "Compartmentation: FSC Condition 3 (granted) requires compartment walls to TGD-B",
            "2024 with minimum 60 minutes fire resistance (REI 60).",
            "Fire dampers: provide to BS 476: Part 7 (note: BS 476-7 is a surface-spread-of-flame",
            "test, withdrawn for this purpose).",
            "Cause-and-effect matrix: to be provided (Appendix F not included in this issue).",
          ].join("\n"),
        },
      ],
      access: [
        {
          filename: "Sanitary Schedule 40006.txt",
          text: [
            "Room 0.06 Changing Places WC: HOI001 ceiling-mounted track hoist, full coverage.",
            "No SWL stated; no structural pad/back-plate; no commissioning standard referenced.",
          ].join("\n"),
        },
      ],
      qs: [
        {
          filename: "Form of Tender — Schedule Part 1.txt",
          text: [
            "Contract: PW-CF5 (Employer-Designed Works).",
            "Section 4.2 — Date for Substantial Completion: ____________ (left blank).",
            "Liquidated Damages per PW-CF5 Clause 9.5.",
          ].join("\n"),
        },
      ],
    },
  };
}

/** The locked advisory disclaimer (spec 08) — shown in the app footer. */
export const DISCLAIMER =
  "VerifIQ is a software-based reading aid. It surfaces, in the documents' own " +
  "words, what a registered professional may wish to read closely. It does not " +
  "certify, sign, opine, or substitute for professional judgement. The registered " +
  "designer reads the output, exercises their own judgement, verifies locally, and " +
  "signs. The professional indemnity remains theirs.";

/** Scan states where the council is still working (poll until it leaves this set). */
export const ACTIVE_STATES = new Set([
  "pending",
  "uploading",
  "classifying",
  "confirm_classify",
  "scanning",
  "cross_ref",
  "peer_challenge",
  "adjudicate",
]);
