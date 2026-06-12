import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge, SectionTitle } from "../components/ui";
import { OrgRegister } from "./OrgRegister";
import { PostNeed } from "./PostNeed";
import { OrgNeeds } from "./OrgNeeds";
import { HandoverPoints } from "./HandoverPoints";
import { MatchList } from "../match/MatchList";

interface Me {
  role: string;
  orgId: string | null;
}

/**
 * Charity console for caseworkers/orgAdmins. If the user isn't attached to a
 * verified org yet, they see the registration/onboarding path first.
 */
export function CharityConsole({ me }: { me: Me }) {
  const org = useQuery(api.orgs.myOrg);

  if (org === undefined) return <p role="status">Loading…</p>;
  if (org === null) return <OrgRegister />;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{org.name}</h1>
        <Badge>{org.status === "verified" ? "RCN verified" : org.status}</Badge>
      </div>
      {org.status !== "verified" ? (
        <Card>
          <p className="mt-2 text-stone-700">
            Your organisation is <strong>pending approval</strong>. A platform administrator will
            verify your RCN ({org.rcn}). You can add handover points now; posting needs unlocks once
            verified.
          </p>
        </Card>
      ) : null}

      {me.role === "orgAdmin" ? (
        <>
          <SectionTitle>Handover points</SectionTitle>
          <HandoverPoints />
        </>
      ) : null}

      {org.status === "verified" ? (
        <>
          <SectionTitle>Post a need</SectionTitle>
          <PostNeed allowedCategories={org.allowedCategories} />
        </>
      ) : null}

      <SectionTitle>Your needs</SectionTitle>
      <OrgNeeds />

      <SectionTitle>Matches</SectionTitle>
      <MatchList />
    </>
  );
}
