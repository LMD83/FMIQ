import { MarketingShell, Wrap, Section } from "@/components/marketing/MarketingShell";
import { SheetTagButton, LeaderButton } from "@/components/ui/Button";

export const metadata = {
  title: "VerifIQ — Hunt · For contractors · Variation exposure read",
  description:
    "Hunt is VerifIQ for contractors. Surface the variation exposure in a tender pack before you price. Source-quoted findings; tactical RFI list; Friday-night discrepancies caught Tuesday morning.",
};

/**
 * Hunt — contractor pre-pricing product page.
 * Product accent: amber (--sev-high). The accent override below cascades
 * through eyebrows, sheet-tag/leader buttons, and rules on this page only.
 */
const ACCENT: React.CSSProperties = {
  // Re-point the page-level accent tokens to the Hunt amber.
  ["--accent" as string]: "var(--sev-high)",
  ["--accent-hover" as string]: "var(--sev-high)",
};

const eyebrow: React.CSSProperties = { color: "var(--sev-high)", display: "block" };

export default function HuntPage() {
  return (
    <MarketingShell>
      <div style={ACCENT}>
        {/* HERO */}
        <Section style={{ paddingTop: 80, paddingBottom: 96 }}>
          <Wrap
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 48,
              alignItems: "end",
            }}
          >
            <div>
              <span className="t-eyebrow" style={{ color: "var(--sev-high)" }}>
                — Drawing 20 · Hunt · For contractors
              </span>
              <h1 className="t-display" style={{ margin: "18px 0" }}>
                The discrepancy you&rsquo;d have found{" "}
                <em style={{ fontStyle: "italic", color: "var(--sev-high)" }}>
                  on Friday at six.
                </em>
              </h1>
              <p className="t-lede" style={{ maxWidth: "32em" }}>
                Hunt reads tender packs before you price them. Source-quoted findings,
                tactical RFI list, variation-exposure read. Tuesday morning, not Friday night.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "center",
                  marginTop: 28,
                  flexWrap: "wrap",
                }}
              >
                <SheetTagButton code="H-001" label="Start a hunt" href="/request" />
                <LeaderButton num="01" label="See the math" href="#scenario" />
              </div>
            </div>

            {/* Validation pack data card */}
            <div className="title-block">
              <span className="t-eyebrow" style={{ color: "var(--sev-high)" }}>
                — Validation pack · pre-tender
              </span>
              <div
                className="t-data"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: "3rem",
                  color: "var(--sev-high)",
                  lineHeight: 1,
                  margin: "16px 0 4px",
                }}
              >
                &euro;3.89m
              </div>
              <span className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
                central exposure surfaced · single Office project pack
              </span>
              <hr className="hairline" style={{ margin: "22px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <Stat value="327" label="findings" color="var(--sev-high)" />
                <Stat value="3" label="critical" color="var(--sev-critical)" />
                <Stat value="38h" label="end-to-end" color="var(--sev-high)" />
              </div>
            </div>
          </Wrap>
        </Section>

        {/* I — WHAT HUNT DOES */}
        <Section>
          <Wrap>
            <SectionHead
              num="I."
              eyebrow="— What Hunt does"
              title="Three reads, before you price."
              lede="Hunt is VerifIQ tuned for contractor bid teams. The chartered review stays where it always was — but the document hunt happens faster than your QS can read it."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 1,
                background: "var(--hairline-strong)",
                border: "1px solid var(--hairline-strong)",
              }}
            >
              <Pillar
                roman="I"
                title="Pre-pricing variation read"
                body="Surface ambiguities, missing scope, contradictory specs, and standards typos before your bid team prices the pack. Each finding source-quoted from the document — you take it into the bid meeting verbatim, not paraphrased."
              />
              <Pillar
                roman="II"
                title="Tactical RFI list"
                body="The 30-item RFI register the Employer's CA was waiting for, but didn't get because their design team is overloaded. Hunt drafts your RFIs in CA-routed language, ready to submit before the query deadline."
              />
              <Pillar
                roman="III"
                title="Variation exposure band"
                body="Headline financial estimate of what unresolved items become if they go to award. €24–270k on a typical mid-size pack. Useful for pricing programme risk, useful for the conversation with your bid director."
              />
            </div>
          </Wrap>
        </Section>

        {/* II — THE MATH */}
        <Section tint>
          <Wrap>
            <div id="scenario" style={{ scrollMarginTop: 80 }} />
            <SectionHead
              num="II."
              eyebrow="— The math"
              title="What it costs you not to hunt."
              lede="One real Office project pack we read pre-tender. The contractor that priced it caught most of these in week 8 of construction, at variation rates rather than tender rates."
            />
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--hairline-strong)",
                padding: "32px 28px",
              }}
            >
              <h3 className="t-h2" style={{ margin: "0 0 16px" }}>
                Pack profile
              </h3>
              <p className="t-body" style={{ margin: "0 0 18px" }}>
                Office project, public-sector procurement under PW-CF5. 161
                documents, five disciplines. Likely Contract Sum &euro;1.1m. Six bidders.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 1,
                  background: "var(--hairline-strong)",
                  border: "1px solid var(--hairline-strong)",
                  margin: "20px 0",
                }}
              >
                <ScenarioStat value="€24k" label="Low band" />
                <ScenarioStat value="€140k" label="Central estimate" />
                <ScenarioStat value="€270k" label="High band" />
              </div>
              <p className="t-body" style={{ margin: "14px 0 0" }}>
                Three critical pre-tender items at &euro;8–&euro;90k each. Five high-severity
                items at &euro;5–&euro;30k each. Twenty medium items at &euro;0.5–&euro;5k each.{" "}
                <strong style={{ color: "var(--text)" }}>
                  Per-pack Hunt fee at this tier: &euro;890.
                </strong>{" "}
                The math is simple.
              </p>
            </div>
          </Wrap>
        </Section>

        {/* PULL QUOTE */}
        <Section style={{ background: "var(--text)" }}>
          <Wrap>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                lineHeight: 1.4,
                color: "var(--bg)",
                maxWidth: "32ch",
                margin: "0 auto",
                textAlign: "center",
              }}
            >
              &ldquo;The discrepancy you&rsquo;d have found on Friday at six — surfaced on
              Tuesday at ten.&rdquo;
            </p>
          </Wrap>
        </Section>

        {/* III — PRICING */}
        <Section>
          <Wrap>
            <SectionHead
              num="III."
              eyebrow="— Pricing · per-pack or annual"
              title="Hunt by pack, hunt by year."
              lede="Per-pack pricing for opportunistic reads. Annual seat for bid teams that price 6+ packs a year."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 1,
                background: "var(--hairline-strong)",
                border: "1px solid var(--hairline-strong)",
                marginTop: 32,
              }}
            >
              <PriceTile
                eyebrow="— Per-pack"
                title="Pack hunt."
                sub="Tier-priced as Verify · Tier I–V"
                price="from €290"
                priceSub="+ VAT · per pack"
                items={[
                  "Full register · source-quoted",
                  "Tactical RFI list (CA-routed format)",
                  "Variation exposure band",
                  "Reviewer-signed audit log",
                  "Same SLA as Verify per tier",
                ]}
                cta={<LeaderButton num="$" label="See full tier table" href="/pricing" />}
              />
              <PriceTile
                featured
                eyebrow="— Annual seat"
                title="Hunt year."
                sub="For bid teams that price >6 packs/year"
                price="from €5,800"
                priceSub="+ VAT · per year"
                items={[
                  "Unlimited Tier II hunts",
                  "Up to 5 named bid-team users",
                  "Concierge priority queue",
                  "Hunt-specific reviewer routing",
                  "Annual exposure-band benchmark report",
                ]}
                cta={<SheetTagButton code="SEAT" label="Take a hunt-year" href="/request" />}
              />
            </div>
          </Wrap>
        </Section>

        {/* IV — WHAT HUNT IS NOT */}
        <Section tint>
          <Wrap narrow>
            <SectionHead
              num="IV."
              eyebrow="— What Hunt is not"
              title="Honest about scope."
              lede="Hunt is a contractor-bid-team reading aid. It is not a tender-strategy consultancy, a price-prediction tool, or a guarantee of bid success."
            />
            <div className="t-body" style={{ fontSize: "1rem", lineHeight: 1.7 }}>
              <p>
                Hunt does not tell you what to bid. It surfaces what&rsquo;s missing, ambiguous,
                or contradictory in the pack so your bid team can price programme risk honestly
                and submit RFIs that move the pack to clarity before tender close.
              </p>
              <p>
                Hunt does not certify the design — the Employer&rsquo;s design team owns that.
                Findings are indicative; the registered professional on either side of the table
                verifies locally.
              </p>
              <p>
                Hunt does not replace your QS or your bid director&rsquo;s judgement. It
                accelerates the document hunt so your QS spends Friday afternoon on the judgement
                calls instead of the page-by-page read.
              </p>
              <p>
                Hunt does not work on packs that violate our locked posture — we will not run Hunt
                on packs you do not have lawful permission to share with us, on US healthcare packs
                without a BAA, or on UK higher-risk-building packs while Building Safety Act posture
                is being finalised.
              </p>
            </div>
          </Wrap>
        </Section>

        {/* NEXT STEP CTA */}
        <Section>
          <Wrap narrow style={{ textAlign: "center" }}>
            <span className="t-eyebrow" style={{ color: "var(--sev-high)" }}>
              — Next step
            </span>
            <h2 className="t-h1" style={{ margin: "14px 0 12px" }}>
              Send a pack. We&rsquo;ll hunt it.
            </h2>
            <p className="t-lede" style={{ margin: "0 0 28px" }}>
              Free taster — one discipline, twenty docs, counts and one worked finding. If the math
              lands, you proceed at tier.
            </p>
            <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
              <SheetTagButton code="FREE" label="Free taster" href="/request" />
              <LeaderButton num="01" label="Request the brief" href="/request" />
            </div>
          </Wrap>
        </Section>

        {/* LOCKED DISCLAIMER */}
        <LockedBlock />
      </div>
    </MarketingShell>
  );
}

/* ---------- page-local building blocks ---------- */

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "1.5rem",
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function SectionHead({
  num,
  eyebrow,
  title,
  lede,
}: {
  num: string;
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16,
        marginBottom: 40,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "3rem",
            color: "var(--sev-high)",
            lineHeight: 1,
          }}
        >
          {num}
        </div>
        <span className="t-eyebrow" style={{ ...eyebrowStyle }}>
          {eyebrow}
        </span>
      </div>
      <div>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          {title}
        </h2>
        <p className="t-lede" style={{ margin: 0, maxWidth: "58ch" }}>
          {lede}
        </p>
      </div>
    </div>
  );
}

const eyebrowStyle: React.CSSProperties = {
  color: "var(--sev-high)",
  display: "block",
  marginTop: 8,
};

function Pillar({ roman, title, body }: { roman: string; title: string; body: string }) {
  return (
    <div style={{ background: "var(--bg)", padding: "32px 24px" }}>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "2.25rem",
          color: "var(--sev-high)",
          lineHeight: 1,
          marginBottom: 16,
        }}
      >
        {roman}
      </div>
      <h3 className="t-h3" style={{ margin: "0 0 12px" }}>
        {title}
      </h3>
      <p className="t-body" style={{ margin: 0, fontSize: "0.9375rem" }}>
        {body}
      </p>
    </div>
  );
}

function ScenarioStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: "var(--surface)", padding: "20px 18px", textAlign: "center" }}>
      <div
        className="t-data"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "1.875rem",
          color: "var(--sev-high)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function PriceTile({
  eyebrow,
  title,
  sub,
  price,
  priceSub,
  items,
  cta,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  price: string;
  priceSub: string;
  items: string[];
  cta: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      style={{
        background: featured ? "var(--surface)" : "var(--bg)",
        padding: "36px 28px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span className="t-eyebrow" style={{ color: "var(--sev-high)" }}>
        {eyebrow}
      </span>
      <h3 className="t-h2" style={{ margin: "8px 0 10px" }}>
        {title}
      </h3>
      <span className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
        {sub}
      </span>
      <div
        className="t-data"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "2.75rem",
          lineHeight: 1,
          color: "var(--text)",
          margin: "18px 0 6px",
        }}
      >
        {price}
      </div>
      <span className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
        {priceSub}
      </span>
      <ul style={{ listStyle: "none", padding: 0, margin: "22px 0", flex: 1 }}>
        {items.map((it) => (
          <li
            key={it}
            className="t-body"
            style={{
              fontSize: "0.875rem",
              padding: "6px 0",
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: "var(--sev-high)", fontWeight: 700, fontSize: "1.25rem" }}>·</span>
            {it}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}

function LockedBlock() {
  return (
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
        <span className="t-eyebrow">— Notice · Locked Disclaimer</span>
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
          VerifIQ is a software-based reading aid. It surfaces, in the documents&rsquo; own words,
          what a registered professional may wish to read closely. It does not certify, sign, opine,
          or substitute for professional judgement. The registered designer reads our output,
          exercises their own judgement, verifies locally, and signs. The professional indemnity
          remains theirs. We carry product-quality risk only.
        </p>
      </Wrap>
    </section>
  );
}
