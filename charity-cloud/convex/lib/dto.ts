/**
 * Charity Cloud — public DTOs (CLAUDE.md rule 2).
 *
 * Public queries return these explicit DTOs ONLY — never raw docs.
 * needs.privateNote, postedByUserId, orgId and any org linkage in the
 * individual flow NEVER leave the server. tests/privacy.test.ts holds a
 * snapshot asserting the EXACT field set of each DTO — that test is the
 * privacy contract; changing a DTO means consciously changing the snapshot.
 */
import { type Doc } from "../_generated/dataModel";

/** What an anonymous/donor browser may see about a need. */
export interface NeedPublicDto {
  id: string;
  pseudonym: string;
  category: string;
  subcategory: string;
  conditionAccepted: string;
  urgency: Doc<"needs">["urgency"];
  qty: number;
  areaLabel: string;
  /** Always the coarse label — never a distance, never coordinates (rule 9). */
  distance: "within ~5km";
  publishedAt: number | null;
}

export function needPublicDto(need: Doc<"needs">): NeedPublicDto {
  return {
    id: need._id,
    pseudonym: need.pseudonym,
    category: need.category,
    subcategory: need.subcategory,
    conditionAccepted: need.conditionAccepted,
    urgency: need.urgency,
    qty: need.qty,
    areaLabel: need.areaLabel,
    distance: "within ~5km",
    publishedAt: need.publishedAt ?? null,
  };
}

/** What a match participant may see about the other side. No real names leak
 *  requester-side: the donor sees only the pseudonym + handover point. */
export interface MatchParticipantDto {
  id: string;
  needId: string;
  needPseudonym: string;
  category: string;
  subcategory: string;
  handoverLabel: string;
  handoverAreaLabel: string;
  status: Doc<"matches">["status"];
}

export function matchParticipantDto(
  match: Doc<"matches">,
  need: Doc<"needs">,
  handover: Doc<"handoverPoints">,
): MatchParticipantDto {
  return {
    id: match._id,
    needId: need._id,
    needPseudonym: need.pseudonym,
    category: need.category,
    subcategory: need.subcategory,
    handoverLabel: handover.label,
    handoverAreaLabel: handover.areaLabel,
    status: match.status,
  };
}
