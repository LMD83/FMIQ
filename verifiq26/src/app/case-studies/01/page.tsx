import Link from "next/link";
import { MarketingShell, Wrap, Section } from "@/components/marketing/MarketingShell";
import { SheetTagButton, LeaderButton } from "@/components/ui/Button";
import { SeverityPill } from "@/components/ui/SeverityPill";
import { SourceQuote } from "@/components/ui/SourceQuote";

export const metadata = {
  title: "VerifIQ — Case study 01 · 327 findings · Office project",
  description:
    "A worked anonymised case study from a 327-finding Office project tender pack read. Ten findings shown in full with verbatim source quotes.",
};

type Stat = { num: string; lab: string; tone?: "crit" | "high" | "med" | "low" };

const HERO_STATS: Stat[] = [
  { num: "327", lab: "Findings · all" },
  { num: "3", lab: "Critical", tone: "crit" },
  { num: "38", lab: "High", tone: "high" },
  { num: "47", lab: "Medium", tone: "med" },
  { num: "22", lab: "Low", tone: "low" },
  { num: "38h", lab: "End-to-end" },
];

const OUTCOME_STATS: Stat[] = [
  { num: "€24–270k", lab: "Variation exposure avoided" },
  { num: "3", lab: "Critical defects pre-release" },
  { num: "30", lab: "RFIs raised pre-tender query deadline" },
  { num: "14", lab: "Items in pre-contract action checklist" },
];

function toneColor(tone?: Stat["tone"]) {
  switch (tone) {
    case "crit":
      return "var(--sev-critical)";
    case "high":
      return "var(--sev-high)";
    case "med":
      return "var(--sev-medium)";
    case "low":
      return "var(--sev-low)";
    default:
      return "var(--gold)";
  }
}

function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 1,
        background: "var(--hairline-strong)",
        border: "1px solid var(--hairline-strong)",
        marginTop: 28,
      }}
    >
      {stats.map((s) => (
        <div key={s.lab} style={{ background: "var(--bg)", padding: "20px 16px" }}>
          <div
            className="t-data"
            style={{ fontSize: "2.25rem", lineHeight: 1, color: toneColor(s.tone) }}
          >
            {s.num}
          </div>
          <div
            className="t-meta"
            style={{ textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 8 }}
          >
            {s.lab}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHead({
  num,
  heading,
  lede,
}: {
  num: string;
  heading: string;
  lede: string;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "2.5rem",
          color: "var(--gold)",
          lineHeight: 1,
        }}
      >
        {num}
      </div>
      <h2 className="t-h2" style={{ color: "var(--text)", margin: "12px 0 10px" }}>
        {heading}
      </h2>
      <p className="t-lede" style={{ margin: 0, maxWidth: "60ch" }}>
        {lede}
      </p>
    </div>
  );
}

type Finding = {
  severity: "critical" | "high";
  code: string;
  discipline: string;
  title: string;
  body?: string;
  quote: string;
  reference: string;
  reco: string;
};

const CRITICAL_FINDINGS: Finding[] = [
  {
    severity: "critical",
    code: "C-01",
    discipline: "Discipline · Contract",
    title: "Employer / Contracting Authority / Building Owner identity ambiguity.",
    body: "The Form of Tender Schedule Part 1 names the Employer at §1.1. The BCAR documentation names a different party as Building Owner at §2.3. The Contracting Authority is not named in either, though referenced throughout. Three references to three roles, mutually inconsistent, on documents intended to bind a single legal entity.",
    quote:
      "The Building Owner is identified as [REDACTED — different party from Form of Tender Schedule Part 1 §1.1].",
    reference: "BCAR Doc · §2.3 · Page 8",
    reco: "Confirm single legal entity with Employer's Representative. Issue Form of Tender Schedule Part 1 and BCAR documentation as Revision B with consistent identity throughout. Add Contracting Authority reference to Title Block on both.",
  },
  {
    severity: "critical",
    code: "C-02",
    discipline: "Discipline · BCAR / Contract",
    title:
      "BCAR document written for Design & Build, but the contract is PW-CF5 Employer-Designed.",
    body: "The BCAR documentation includes language consistent with a Design & Build procurement route — placing design responsibility on the Builder for elements that the Employer's design team has already designed. The contract form is PW-CF5 (Employer-Designed). The BCAR documentation and contract form are mutually inconsistent on the allocation of design responsibility.",
    quote:
      "The Builder shall complete the design of [REDACTED — element already designed by the Employer's M&E consultant].",
    reference: "BCAR Doc · §3.2 · Page 11",
    reco: "Re-issue BCAR documentation aligned to PW-CF5 Employer-Designed scope. Confirm with Assigned Certifier that the Builder is not being held responsible for design completion outside the contract form's allocation. Issue as Revision B.",
  },
  {
    severity: "critical",
    code: "C-03",
    discipline: "Discipline · Contract",
    title: "Date for Substantial Completion is left blank.",
    body: "The Date for Substantial Completion is a required entry in the Form of Tender Schedule, Part 1, Section 4.2. Without a specified date, the Liquidated Damages mechanism set out in PW-CF5 Clause 9.5 cannot be enforced. This is a material defect in the tender pack — bidders cannot price contract programme risk and the Employer cannot enforce damages for delay.",
    quote: "Date for Substantial Completion: ____________",
    reference: "Form of Tender · Schedule Part 1 · §4.2 · Page 12",
    reco: "Insert Date for Substantial Completion before tender release. Confirm with Employer's Representative and re-issue Form of Tender Schedule Part 1 as Revision B.",
  },
];

const HIGH_FINDINGS: Finding[] = [
  {
    severity: "high",
    code: "H-04",
    discipline: "M&E",
    title: "Hoist brand named differently across M&E spec, RDS, and schedule.",
    quote:
      "Hoist supplier: [REDACTED — Brand A] (M&E spec). Hoist supplier: [REDACTED — Brand B] (Room Data Sheet 12). Hoist supplier: [REDACTED — Brand C] (Schedule of Mechanical Items).",
    reference: "M&E Spec §11.4 · RDS 12 · Sch M.04",
    reco: "Reconcile to single specified hoist brand across all three documents. Confirm SWL and sling-integration consistency.",
  },
  {
    severity: "high",
    code: "H-09",
    discipline: "Electrical",
    title: '"I.S. EN 10101" cited — this Irish Standard prefix does not exist.',
    quote: "All electrical installations shall comply with I.S. EN 10101 latest edition.",
    reference: "Elec Spec · §3.1.2 · Page 14",
    reco: "Suspected typo for I.S. 10101:2020 (Electrical installations of buildings). Confirm with electrical engineer and re-issue Elec Spec as Revision B with correct standard reference.",
  },
  {
    severity: "high",
    code: "H-12",
    discipline: "Fire",
    title: "Cause-and-effect matrix referenced but not appended to pack.",
    quote: "Refer to Cause-and-Effect Matrix (Appendix F) for system interlocks.",
    reference: "Fire Strategy · §6.4 · Page 21",
    reco: "Append Appendix F before tender release. Cause-and-effect matrix is required for bidder pricing of fire-detection, suppression, and shutdown interlocks.",
  },
  {
    severity: "high",
    code: "H-18",
    discipline: "Architecture / Access",
    title: "Ancillary Certificate list mismatched to design scope.",
    quote:
      "Ancillary Certificates required: [REDACTED — list omits four specialist trades present in the design].",
    reference: "BCAR Doc · §5.1 · Page 18",
    reco: "Reconcile Ancillary Certificate list with actual design scope. Confirm with Assigned Certifier prior to release.",
  },
  {
    severity: "high",
    code: "H-22",
    discipline: "QS / Procurement",
    title: "ITT date arithmetic does not align with stated tender period.",
    quote:
      "Tender period: 4 weeks from ITT issue date [DATE-A] to query deadline [DATE-B] — calculated period is 19 calendar days, not 28.",
    reference: "ITT · Cover · Page 2",
    reco: "Reconcile dates or amend stated period. Misalignment risks tender process challenge and bid invalidation.",
  },
  {
    severity: "high",
    code: "H-29",
    discipline: "M&E",
    title: "M&E specification references wrong project address.",
    quote: "For installations at [REDACTED — different project address from Title Block]…",
    reference: "M&E Spec · Cover · Page 1",
    reco: "Re-issue M&E spec with correct project address. Cover-page misalignment risks bid confusion and invoice misallocation.",
  },
  {
    severity: "high",
    code: "H-33",
    discipline: "Architecture",
    title: "Contradictory car-park scope statements.",
    quote:
      "Car park scope: [REDACTED — Drawing schedule reads 18 spaces] / Car park scope: [REDACTED — Spec reads 24 spaces].",
    reference: "Drawings · Schedule of Spaces · vs. Arch Spec §4.2",
    reco: "Reconcile car-park scope across drawing schedule and Architectural specification. Coordinate with civils for hardstanding extents.",
  },
];

function FindingCard({ f }: { f: Finding }) {
  const isCritical = f.severity === "critical";
  return (
    <article
      style={{
        background: "var(--bg)",
        border: `1px solid ${isCritical ? "var(--sev-critical)" : "var(--hairline-strong)"}`,
        padding: "28px 26px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <SeverityPill severity={f.severity} />
        <span
          className="t-eyebrow"
          style={isCritical ? { color: "var(--sev-critical)" } : undefined}
        >
          {f.code}
        </span>
        <span className="t-meta">{f.discipline}</span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "1.375rem",
          lineHeight: 1.25,
          margin: "0 0 12px",
          color: isCritical ? "var(--sev-critical)" : "var(--text)",
        }}
      >
        {f.title}
      </h3>
      {f.body && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color: "var(--text-soft)",
            margin: "0 0 16px",
          }}
        >
          {f.body}
        </p>
      )}
      <SourceQuote quote={f.quote} reference={f.reference} />
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
        <span
          className="t-meta"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            display: "block",
            marginBottom: 6,
          }}
        >
          — Recommended action
        </span>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--text-soft)",
            margin: 0,
          }}
        >
          {f.reco}
        </p>
      </div>
    </article>
  );
}

export default function CaseStudy01Page() {
  return (
    <MarketingShell>
      {/* Hero */}
      <header
        style={{
          padding: "64px 0",
          borderBottom: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
        }}
      >
        <Wrap>
          <span className="t-eyebrow">— Reference · 01 · Anonymised</span>
          <h1 className="t-h1" style={{ color: "var(--text)", margin: "14px 0 12px" }}>
            Office project tender pack.
          </h1>
          <p className="t-lede" style={{ maxWidth: "60ch" }}>
            A worked anonymised example. 161 documents across five disciplines. Three weeks in front
            of the team&apos;s planned tender release date.
          </p>
          <StatRow stats={HERO_STATS} />
          <p
            className="t-meta"
            style={{ textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 18 }}
          >
            Identifiers anonymised · findings reproduced verbatim · standards references preserved
          </p>
        </Wrap>
      </header>

      {/* I — Why this engagement */}
      <Section>
        <Wrap narrow>
          <SectionHead
            num="I."
            heading="Why this engagement."
            lede="The design team had three weeks to tender release. A sample-read against the live Irish corpus and PW-CF5 contract form, with reviewer sign-off on every released finding."
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-soft)",
              margin: "0 0 16px",
            }}
          >
            The Office project tender pack covered architecture, structures, M&amp;E, fire, and BCAR — five
            disciplines, 161 documents. The Employer was a public-sector body procuring under CWMF
            using PW-CF5 (Employer-Designed Works Contract). Programme pressure was real; the tender
            release date was anchored against a wider capital-programme milestone.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-soft)",
              margin: 0,
            }}
          >
            VerifIQ ran a multi-disciplinary discrepancy register on the pack. End-to-end: 38 hours.
            The output: 327 findings, source-quoted, severity-classed, reviewer-signed. The design
            team integrated the findings into their pre-tender RFI register and re-issued affected
            documents as Revision B.
          </p>
        </Wrap>
      </Section>

      {/* II — Three critical findings */}
      <Section tint>
        <Wrap narrow>
          <SectionHead
            num="II."
            heading="Three critical findings — in full."
            lede="Each surfaced with the verbatim sentence from the source document and the page reference. Reproduced here exactly as released to the design team."
          />
          {CRITICAL_FINDINGS.map((f) => (
            <FindingCard key={f.code} f={f} />
          ))}
        </Wrap>
      </Section>

      {/* III — Seven high-severity findings */}
      <Section>
        <Wrap narrow>
          <SectionHead
            num="III."
            heading="Seven high-severity findings."
            lede="A representative sample of the 38 high-severity findings. Each one reproduced with the verbatim source quote."
          />
          {HIGH_FINDINGS.map((f) => (
            <FindingCard key={f.code} f={f} />
          ))}
        </Wrap>
      </Section>

      {/* IV — What this delivered */}
      <Section tint>
        <Wrap narrow>
          <SectionHead
            num="IV."
            heading="What this delivered."
            lede="Numbers from the engagement. Real, anonymised, verifiable on request."
          />
          <StatRow stats={OUTCOME_STATS} />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-soft)",
              margin: "24px 0 0",
            }}
          >
            Each critical finding represented a category of risk between €8k and €90k in likely
            contract-variation exposure if left unresolved at award. Conservatively, the engagement
            avoided <strong>€24k–€270k of variation exposure</strong> (5–25% of likely Contract Sum)
            by surfacing the issues in time for pre-tender re-issue rather than post-award RFI.
          </p>
        </Wrap>
      </Section>

      {/* V — What this does NOT show */}
      <Section>
        <Wrap narrow>
          <SectionHead
            num="V."
            heading="What this case study does NOT show."
            lede="Honesty about scope."
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-soft)",
              margin: "0 0 16px",
            }}
          >
            During the pilot cohort, findings outside the founder-reviewer&apos;s direct discipline are{" "}
            <strong>surfaced</strong> on the register but <strong>not signed</strong> as
            chartered-reviewed. On this 327-finding pack, that means: contract / procurement /
            coordination findings (the ones reproduced above) carry full reviewer sign-off, signed by
            Liam Doolan; architecture / structures / M&amp;E adequacy / fire engineering / energy
            findings are marked &quot;pending reviewer sign-off · [discipline]&quot; — they are still
            on your register, but with that honesty stamp.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text-soft)",
              margin: 0,
            }}
          >
            As discipline specialists join the cohort (RIAI architect, CEng C&amp;S, CEng MEP, FSE),
            each &quot;pending&quot; tag retires one discipline at a time.{" "}
            <Link href="/solo-reviewer-policy">Read the full Solo Reviewer Phase policy ↗</Link>
          </p>
        </Wrap>
      </Section>

      {/* Next step */}
      <Section tint>
        <Wrap narrow style={{ textAlign: "center" }}>
          <span className="t-eyebrow">— Next step</span>
          <h2 className="t-h1" style={{ color: "var(--text)", margin: "14px 0 12px" }}>
            Your pack, read like this.
          </h2>
          <p className="t-lede" style={{ margin: "0 0 28px" }}>
            Same method, your pack. Free taster — one discipline, twenty docs, counts plus one worked
            finding. Then proceed at tier if it lands.
          </p>
          <div
            style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}
          >
            <SheetTagButton code="FREE" label="Run a free taster" href="/request" />
            <LeaderButton num="$" label="See pricing" href="/pricing" />
          </div>
        </Wrap>
      </Section>

      {/* Locked disclaimer */}
      <section
        style={{
          padding: "48px 0",
          borderTop: "1px solid var(--hairline-strong)",
          borderBottom: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
          textAlign: "center",
        }}
      >
        <Wrap narrow>
          <span className="t-eyebrow">— Notice · Locked disclaimer</span>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "var(--text)",
              maxWidth: "58ch",
              margin: "14px auto",
              padding: "0 20px",
            }}
          >
            VerifIQ is a software-based reading aid. It surfaces, in the documents&apos; own words,
            what a registered professional may wish to read closely. It does not certify, sign,
            opine, or substitute for professional judgement. The registered designer reads our
            output, exercises their own judgement, verifies locally, and signs. The professional
            indemnity remains theirs. We carry product-quality risk only.
          </p>
        </Wrap>
      </section>
    </MarketingShell>
  );
}
