/**
 * VerifIQ — geo result → §05.1 Finding mapper (Phase 5).
 *
 * Turns a GeoLayerResult into a council Finding so site-constraint checks flow
 * into the same register/report. A gated/unreachable layer becomes a tracked
 * "evidence required" finding (the product value); a present constraint (e.g.
 * High Radon Area) becomes a discipline finding with its statutory anchor.
 *
 * Version: 0.8.0-phase5
 */

import type { Finding } from "../types/index.js";
import type { GeoLayerResult } from "./types.js";

const DISCIPLINE = "Geospatial / Site Constraints";
const OWNER = "Lead Designer";

/** A geo finding, or null when there's nothing to flag (constraint absent). */
export function geoFinding(result: GeoLayerResult, seq = 1): Finding | null {
  if (result.status === "manual-request-required") {
    return build(result, seq, {
      requirement: `The ${result.layer} constraint must be confirmed for the site.`,
      finding: result.summary,
      status: "Clarification required",
      risk: "Medium",
      required_evidence: [
        `Confirm ${result.layer} status — request from ${result.requestFrom ?? "the relevant authority"}`,
      ],
    });
  }

  if (result.status === "resolved" && result.flagged) {
    if (result.layer === "radon") {
      return build(result, seq, {
        requirement: "TGD C: radon-resisting measures are required in High Radon Areas.",
        finding: result.summary,
        status: "Not demonstrated",
        risk: "Medium",
        required_evidence: ["Confirm a radon-resisting membrane in the floor build-up (TGD C)"],
      });
    }
    if (result.layer === "flood") {
      return build(result, seq, {
        requirement:
          "Planning System & Flood Risk Management Guidelines: a site in Flood Zone A/B needs a site-specific Flood Risk Assessment.",
        finding: result.summary,
        status: "Not demonstrated",
        risk: "High",
        required_evidence: [
          "Provide a site-specific Flood Risk Assessment and the Justification Test outcome",
        ],
      });
    }
    if (result.layer === "geology") {
      return build(result, seq, {
        requirement:
          "Adverse ground conditions require a ground investigation and geotechnical design to Eurocode 7 (IS EN 1997).",
        finding: result.summary,
        status: "Not demonstrated",
        risk: "Medium",
        required_evidence: [
          "Provide a ground investigation / geotechnical report addressing the mapped ground condition",
        ],
      });
    }
    if (result.layer === "zoning") {
      return build(result, seq, {
        requirement:
          "The proposed use must be consistent with the development-plan zoning objective (material-contravention risk).",
        finding: result.summary,
        status: "Clarification required",
        risk: "Medium",
        required_evidence: [
          "Confirm the proposed use is consistent with the zoning objective, or that permission addresses any contravention",
        ],
      });
    }
    if (result.layer === "ecology") {
      return build(result, seq, {
        requirement:
          "Habitats/Birds Directives (S.I. 477/2011): a project affecting a European site requires Appropriate Assessment screening.",
        finding: result.summary,
        status: "Not demonstrated",
        risk: "High",
        required_evidence: [
          "Provide the Appropriate Assessment screening determination (and NIS if a Stage 2 assessment is required)",
        ],
      });
    }
    if (result.layer === "heritage") {
      return build(result, seq, {
        requirement:
          "National Monuments Acts: works at/near a Recorded Monument require statutory notice before commencement.",
        finding: result.summary,
        status: "Not demonstrated",
        risk: "High",
        required_evidence: [
          "Confirm statutory notice to the National Monuments Service and any archaeological mitigation",
        ],
      });
    }
    return build(result, seq, {
      requirement: `A ${result.layer} constraint applies to the site.`,
      finding: result.summary,
      status: "Not demonstrated",
      risk: "Medium",
      required_evidence: [`Confirm how the ${result.layer} constraint is addressed`],
    });
  }

  return null;
}

function build(
  result: GeoLayerResult,
  seq: number,
  parts: Pick<Finding, "requirement" | "finding" | "status" | "risk" | "required_evidence">,
): Finding {
  return {
    issue_id: `GEO-PRE-${String(seq).padStart(4, "0")}`,
    discipline_origin: DISCIPLINE,
    interface_disciplines: [],
    stage: "design",
    source_document: `${result.layer} constraint map`,
    source_reference: result.requestFrom ?? `${result.layer} layer`,
    related_documents: [],
    build_readiness_impact: "Pre-construction close-out",
    owner: OWNER,
    close_out_stage: "pre-build",
    ...parts,
  };
}
