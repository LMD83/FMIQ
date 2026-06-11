import Link from "next/link";
import { MarketingShell, Wrap, Section } from "@/components/marketing/MarketingShell";
import { SheetTagButton, LeaderButton } from "@/components/ui/Button";
import { SeverityPill } from "@/components/ui/SeverityPill";
import { SourceQuote } from "@/components/ui/SourceQuote";

export const metadata = {
  title: "VerifIQ — Know before you build.",
  description:
    "VerifIQ convenes a virtual Pre-Build Compliance Council across your project disciplines and returns one coordinated, source-quoted decision. Multi-discipline review, reviewer-gated, indicative — for Irish project teams.",
};

/** Section header with the roman-numeral eyebrow column used across the page. */
function SectionHead({
  num,
  eyebrow,
  title,
  lede,
  onDark = false,
}: {
  num: string;
  eyebrow: string;
  title: string;
  lede: string;
  onDark?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16,
        marginBottom: 48,
      }}
    >
      <div>
        <div
          className="t-data"
          style={{ fontSize: "4rem", lineHeight: 1, color: "var(--gold)" }}
        >
          {num}
        </div>
        <span className="t-eyebrow" style={{ display: "block", marginTop: 12 }}>
          {eyebrow}
        </span>
      </div>
      <div>
        <h2 className="t-h2" style={{ margin: "0 0 16px", color: onDark ? "var(--c-bone)" : "var(--text)" }}>
          {title}
        </h2>
        <p
          className="t-lede"
          style={{ margin: 0, maxWidth: "60ch", color: onDark ? "var(--c-vellum)" : "var(--text-muted)" }}
        >
          {lede}
        </p>
      </div>
    </div>
  );
}

const cellGrid: React.CSSProperties = {
  display: "grid",
  gap: 1,
  background: "var(--hairline-strong)",
  border: "1px solid var(--hairline-strong)",
};

export default function Page() {
  return (
    <MarketingShell>
      {/* ================ HERO ================ */}
      <header
        style={{
          position: "relative",
          padding: "96px 0 120px",
          borderBottom: "1px solid var(--hairline-strong)",
          overflow: "hidden",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2400&auto=format&fit=crop"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.1,
            filter: "grayscale(1)",
            pointerEvents: "none",
          }}
        />
        <Wrap style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr", gap: 48 }}>
          <div>
            <span className="t-eyebrow">Pre-Construction Compliance Checks</span>
            <h1
              className="t-display"
              style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", lineHeight: 0.98, margin: "24px 0", color: "var(--text)" }}
            >
              Are we actually{" "}
              <span style={{ color: "var(--gold)", fontStyle: "italic", fontWeight: 500 }}>
                ready to build?
              </span>
            </h1>
            <p
              className="t-lede"
              style={{ fontSize: "1.375rem", lineHeight: 1.5, color: "var(--text-soft)", maxWidth: "30em" }}
            >
              Know before you build. VerifIQ convenes a virtual Pre-Build Compliance Council across your
              project disciplines, returns one coordinated decision — Proceed, Proceed with conditions, Pause
              before build, or Insufficient information. Source-quoted. Reviewer-gated. Indicative.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 28 }}>
              <span className="t-meta">Review your Construction Tender Pack before you go to market</span>
              <span className="t-meta">Standards · I.S. · TGD · BCAR · CWMF · PW-CF</span>
              <span className="t-meta">EU data residency · Dublin</span>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 36, flexWrap: "wrap" }}>
              <SheetTagButton code="A-001" label="Request the brief" href="/request" />
              <LeaderButton num="01" label="View references" href="#references" />
            </div>
          </div>
          <div style={{ alignSelf: "end" }}>
            <div style={{ border: "1px solid var(--hairline-strong)", background: "var(--surface)", padding: "28px 24px" }}>
              <span className="t-eyebrow">— Real engagement · validation pack</span>
              <div className="t-data" style={{ fontSize: "3rem", lineHeight: 1, color: "var(--gold)", margin: "16px 0 4px" }}>
                327
              </div>
              <span className="t-meta">findings surfaced · 5 disciplines · 161 docs</span>
              <hr className="hairline" style={{ margin: "22px 0" }} />
              <div style={{ display: "flex", gap: 22 }}>
                <div>
                  <div className="t-data" style={{ fontSize: "1.75rem", color: "var(--sev-critical)" }}>3</div>
                  <span className="t-meta">critical</span>
                </div>
                <div>
                  <div className="t-data" style={{ fontSize: "1.75rem", color: "var(--sev-high)" }}>38</div>
                  <span className="t-meta">high</span>
                </div>
                <div>
                  <div className="t-data" style={{ fontSize: "1.75rem", color: "var(--sev-medium)" }}>47</div>
                  <span className="t-meta">medium</span>
                </div>
              </div>
              <p className="t-meta" style={{ marginTop: 22 }}>
                Office project · Dublin · MMXXVI
              </p>
            </div>
          </div>
        </Wrap>
      </header>

      {/* ================ LOCKED MANIFESTO STRIP ================ */}
      <section
        style={{
          padding: "56px 0",
          borderBottom: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
          textAlign: "center",
        }}
      >
        <Wrap narrow>
          <span className="t-eyebrow">— Manifesto · Locked</span>
          <p
            className="t-lede"
            style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--text)", maxWidth: "60ch", margin: "16px auto 0" }}
          >
            VerifIQ is a software-based reading aid. It surfaces, in the documents&apos; own words, what a
            registered professional may wish to read closely. It does not certify, sign, opine, or substitute
            for professional judgement. The registered designer reads our output, exercises their own
            judgement, verifies locally, and signs. The professional indemnity remains theirs. We carry
            product-quality risk only.
          </p>
        </Wrap>
      </section>

      {/* ================ THREE PRINCIPLES ================ */}
      <Section>
        <Wrap>
          <SectionHead
            num="II."
            eyebrow="— Principles"
            title="Three things we hold to."
            lede="Trust is not a tagline. It is held in three operational disciplines, written into the platform."
          />
          <div style={{ ...cellGrid, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {[
              {
                roman: "I",
                h: "Source-Quoted",
                p: "Every finding carries the verbatim sentence from the source document. No paraphrase. No invention. If the source cannot be quoted, the finding is dropped before any reviewer sees it.",
              },
              {
                roman: "II",
                h: "Honestly Reviewed",
                p: "Pilot packs are reviewed by the founder — a chartered specialist in Irish public-sector procurement and capital governance. Discipline specialists (architecture, M&E, fire, structures) are joining the cohort sequentially. Findings outside the current reviewer's discipline are marked transparently.",
              },
              {
                roman: "III",
                h: "No PI Exposure",
                p: "VerifIQ does not certify. We surface; you verify locally; you sign. The professional indemnity stays with you. The shortcut is what we give you in return.",
              },
            ].map((pr) => (
              <div key={pr.roman} style={{ background: "var(--bg)", padding: "36px 28px" }}>
                <div className="t-data" style={{ fontSize: "2.5rem", color: "var(--gold)", lineHeight: 1, marginBottom: 18 }}>
                  {pr.roman}
                </div>
                <h3 className="t-h3" style={{ margin: "0 0 14px", color: "var(--text)" }}>
                  {pr.h}
                </h3>
                <p className="t-body" style={{ margin: 0 }}>
                  {pr.p}
                </p>
              </div>
            ))}
          </div>
        </Wrap>
      </Section>

      {/* ================ METHOD TIMELINE ================ */}
      <Section tint>
        <Wrap>
          <SectionHead
            num="III."
            eyebrow="— Method"
            title="From bench to read, in five strikes."
            lede="Method is the work. Each strike is a hand-pass through the pack, against a corpus, ending in a chartered eye."
          />
          <div style={{ ...cellGrid, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {[
              { mk: "I", label: "Intake", h: "Magic-link upload.", p: "Per discipline · ZIP · 600 doc cap at Tier III" },
              { mk: "II", label: "Classify", h: "Discipline & type.", p: "Manifest built · routing decided" },
              { mk: "III", label: "Read", h: "Per-discipline read.", p: "Source-quote verified · severity-classed" },
              { mk: "IV", label: "Review", h: "Chartered gate.", p: "Human-in-loop · Dublin", current: true },
              { mk: "V", label: "Issue", h: "Register & RFIs.", p: "XLSX · DOCX · audit log" },
            ].map((s) => (
              <div
                key={s.mk}
                style={{ background: s.current ? "var(--surface)" : "var(--bg)", padding: "32px 22px" }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `1px solid ${s.current ? "var(--gold)" : "var(--hairline-strong)"}`,
                    background: s.current ? "var(--gold)" : "var(--bg)",
                    color: s.current ? "var(--c-ink)" : "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-serif)",
                    fontWeight: 500,
                    marginBottom: 18,
                  }}
                >
                  {s.mk}
                </div>
                <div className="t-eyebrow" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
                  {s.label}
                </div>
                <h4 className="t-lede" style={{ fontSize: "1.25rem", color: "var(--text)", margin: "0 0 10px" }}>
                  {s.h}
                </h4>
                <p className="t-meta" style={{ margin: 0, color: "var(--text-soft)" }}>
                  {s.p}
                </p>
              </div>
            ))}
          </div>
        </Wrap>
      </Section>

      {/* ================ THREE PRODUCTS ================ */}
      <Section>
        <Wrap>
          <SectionHead
            num="IV."
            eyebrow="— Portfolio"
            title="Three products. One platform. One method."
            lede="The same source-quoted read behind each. The point of entry changes with the role."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
            <ProductCard
              href="/products"
              tag="I · Verify"
              eyebrow="— Verify · I"
              title="For the Design Team."
              meta="Multi-discipline · Pre-tender · Office project"
              body="A full pre-tender read of the design pack across all the disciplines on your project. The atelier's flagship."
              link="Learn more about Verify"
              img="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop"
              alt="Architectural plans on a drafting table"
              accent="var(--gold)"
            />
            <ProductCard
              href="/hunt"
              tag="II · Hunt"
              eyebrow="— Hunt · II"
              title="For Contractors."
              meta="Variation exposure · Pre-pricing"
              link="Visit Hunt"
              img="https://images.unsplash.com/photo-1581094288338-2314dddb7ece?q=80&w=1100&auto=format&fit=crop"
              alt="Construction site with cranes"
              accent="var(--sev-high)"
            />
            <div
              style={{
                background: "var(--elevated)",
                border: "1px solid var(--hairline-strong)",
                padding: "32px 28px",
                display: "flex",
                alignItems: "center",
                minHeight: 220,
              }}
            >
              <p
                className="t-lede"
                style={{ fontSize: "1.375rem", lineHeight: 1.4, color: "var(--text)", margin: 0 }}
              >
                &ldquo;The discrepancy you&apos;d have found on Friday at six — surfaced on Tuesday at ten.&rdquo;
              </p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <ProductCard
                href="/studio"
                tag="III · Studio"
                eyebrow="— Studio · III"
                title="For the Sole Practitioner."
                meta="Single discipline · One pack · Lighter touch"
                link="Visit Studio"
                img="https://images.unsplash.com/photo-1503328427499-d92d1ac3d174?q=80&w=2000&auto=format&fit=crop"
                alt="Hand drafting architectural drawings"
                accent="var(--sev-low)"
                wide
              />
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ================ ONE WORKED FINDING ================ */}
      <Section tint>
        <Wrap narrow>
          <SectionHead
            num="V."
            eyebrow="— Worked Finding"
            title="One finding, in full."
            lede="The method, on one example. The 327-finding Office project pack referenced above contained this — a critical contract-form defect."
          />
          <div style={{ border: "1px solid var(--hairline-strong)", background: "var(--surface)", padding: "32px 28px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12, alignItems: "center" }}>
              <SeverityPill severity="critical" />
              <span className="t-eyebrow" style={{ color: "var(--sev-critical)" }}>
                Finding · C-03
              </span>
              <span className="t-meta">Discipline · Contract</span>
            </div>
            <h3 className="t-h2" style={{ fontSize: "1.75rem", lineHeight: 1.2, margin: "0 0 16px", color: "var(--text)" }}>
              Date for Substantial Completion is left blank.
            </h3>
            <p className="t-body" style={{ margin: "0 0 22px" }}>
              The Date for Substantial Completion is a required entry in the Form of Tender Schedule, Part 1,
              Section 4.2. Without a specified date, the Liquidated Damages mechanism in PW-CF5 Clause 9.5
              cannot be enforced. This is a material defect in the tender pack — bidders cannot price contract
              programme risk and the Employer cannot enforce damages for delay.
            </p>
            <SourceQuote
              quote={'"Date for Substantial Completion: ____________"'}
              reference="Form of Tender · Schedule Part 1 · §4.2 · Page 12"
            />
            <div style={{ marginTop: 22 }}>
              <span className="t-eyebrow">— Recommended action</span>
              <p className="t-body" style={{ margin: "8px 0 0" }}>
                Insert Date for Substantial Completion before tender release. Confirm with the Employer&apos;s
                Representative and re-issue the Form of Tender Schedule Part 1 as Revision B.
              </p>
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ================ STANDARDS WALL ================ */}
      <Section>
        <Wrap>
          <SectionHead
            num="VI."
            eyebrow="— Corpora"
            title="Standards we read against."
            lede="The published Irish standards and frameworks the design team already cites. Indexed, not affiliated."
          />
          <div style={{ ...cellGrid, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {[
              { mark: "RIAI", sub: "Architects" },
              { mark: "EI", sub: "Engineers Ireland" },
              { mark: "SCSI", sub: "Surveyors" },
              { mark: "ACEI", sub: "Consulting Eng." },
              { mark: "OGP", sub: "CWMF · PW-CF" },
              { mark: "NSAI", sub: "I.S. · I.S. EN" },
            ].map((c) => (
              <div key={c.mark} style={{ background: "var(--bg)", padding: "28px 18px", textAlign: "center" }}>
                <div
                  className="t-h2"
                  style={{ fontSize: "1.875rem", color: "var(--gold)", marginBottom: 6, lineHeight: 1 }}
                >
                  {c.mark}
                </div>
                <div className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {c.sub}
                </div>
              </div>
            ))}
          </div>
          <p
            className="t-meta"
            style={{
              textAlign: "center",
              marginTop: 28,
              paddingTop: 16,
              borderTop: "1px solid var(--hairline-strong)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Corpora indexed · not affiliations · published standards only
          </p>
        </Wrap>
      </Section>

      {/* ================ REVIEWER TRANSPARENCY ================ */}
      <Section tint>
        <Wrap>
          <SectionHead
            num="VII."
            eyebrow="— Reviewer · Transparency"
            title="Who reads the findings before they leave the atelier."
            lede={'We tell you exactly who is reviewing the pack. No anonymous "expert panel." No claim we can’t back.'}
          />
          <div
            style={{
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface)",
              padding: "36px 32px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 28,
            }}
          >
            <div>
              <span className="t-eyebrow">— Pilot reviewer</span>
              <div
                className="t-lede"
                style={{ fontSize: "1.5rem", color: "var(--text)", lineHeight: 1.3, marginTop: 10 }}
              >
                Liam Doolan,
                <br />
                founder.
              </div>
              <p className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase", margin: "16px 0 0" }}>
                Irish capital delivery · CWMF / PW-CF specialism
              </p>
            </div>
            <div>
              <p className="t-body">
                During pilot cohort, Liam signs the audit log on every paid pack within his discipline —
                procurement, contract-form, document hygiene, cross-document coordination. Findings outside
                that discipline are surfaced and marked transparently as &ldquo;pending reviewer sign-off ·
                [discipline]&rdquo; until the relevant specialist joins the cohort. The honesty is the product.
              </p>
              <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 12 }}>
                {[
                  "+ Architecture · RIAI · joining",
                  "+ Structures · CEng C&S · joining",
                  "+ M&E · CEng MEP · joining",
                  "+ Fire · FSE · joining",
                ].map((li) => (
                  <li
                    key={li}
                    className="t-meta"
                    style={{
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                      padding: "6px 12px",
                      border: "1px solid var(--accent)",
                      background: "var(--bg)",
                    }}
                  >
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ================ REFERENCES ================ */}
      <Section>
        <Wrap>
          <div id="references" style={{ position: "relative", top: -90 }} aria-hidden />
          <SectionHead
            num="VIII."
            eyebrow="— References · Anonymised"
            title="Three packs, in conversation."
            lede="References from the Irish practice. Findings are real; identifiers are not."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
            <RefCard
              tag="Ref · 01 · Health"
              img="https://images.unsplash.com/photo-1538108149393-fbbd81895907?q=80&w=1100&auto=format&fit=crop"
              alt="Healthcare interior"
              title="Office project."
              body="Office project tender pack · 161 documents · 5 disciplines. The atelier surfaced 327 source-quoted findings. Three critical: identity ambiguity, BCAR doc written for wrong contract form, blank LD date."
              stats={[
                { num: "327", lab: "findings" },
                { num: "3", lab: "critical" },
                { num: "€24–270k", lab: "exposure" },
              ]}
              href="/case-studies/01"
            />
            <RefCard
              tag="Ref · 02 · Heritage"
              img="https://images.unsplash.com/photo-1531844896269-29f8eafde5dd?q=80&w=1100&auto=format&fit=crop"
              alt="Georgian Dublin façade"
              title="Protected Georgian, refurbished."
              body="Conservation-architect-led refurbishment of a Protected Structure in Dublin 2. Reviewed against conservation method statement, TGD M, BS 8300-2. Twelve findings."
              stats={[
                { num: "12", lab: "findings" },
                { num: "2", lab: "material" },
                { num: "RIAI", lab: "conservation" },
              ]}
            />
            <RefCard
              tag="Ref · 03 · Cat A"
              img="https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1100&auto=format&fit=crop"
              alt="Modern office building"
              title="Cat-A office, pre-tender."
              body="Cat-A fit-out tender for a Docklands office. The atelier surfaced contradictions between M&E spec and BMS schedule, plus an ITT date arithmetic error that would have voided two bids."
              stats={[
                { num: "82", lab: "findings" },
                { num: "4", lab: "critical" },
                { num: "38h", lab: "end-to-end" },
              ]}
            />
          </div>
        </Wrap>
      </Section>

      {/* ================ PRICING TEASER ================ */}
      <Section>
        <Wrap>
          <div id="pricing" style={{ position: "relative", top: -90 }} aria-hidden />
          <SectionHead
            num="IX."
            eyebrow="— Pricing · Ireland"
            title="Five tiers. One read."
            lede="Predictable per pack, or annual seat for the practice. Free taster — one discipline, one pack per quarter, no card."
          />
          <div style={{ ...cellGrid, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {[
              { roman: "I", name: "Small", meta: "< 50 docs · 1 discipline", price: "€290", sub: "+ VAT · per pack" },
              { roman: "II", name: "Mid", meta: "50–150 · 1–3 disc.", price: "€590", sub: "+ VAT · per pack" },
              { roman: "III", name: "Large", meta: "150–600 · full team", price: "€890", sub: "+ VAT · per pack", featured: true },
              { roman: "IV", name: "Programme", meta: "600–1,500 · multi-pack", price: "€1,950", sub: "+ VAT · per pack" },
              { roman: "V", name: "Mega", meta: "> 1,500 · by arr.", price: "from €2,500", sub: "concierge · by arr." },
            ].map((t) => (
              <div
                key={t.roman}
                style={{ background: t.featured ? "var(--surface)" : "var(--bg)", padding: "24px 18px", textAlign: "center" }}
              >
                <div className="t-h2" style={{ fontSize: "1.5rem", color: "var(--gold)", lineHeight: 1, marginBottom: 8 }}>
                  {t.roman}
                </div>
                <div className="t-h3" style={{ fontSize: "0.875rem", color: "var(--text)", marginBottom: 8 }}>
                  {t.name}
                </div>
                <span className="t-meta">{t.meta}</span>
                <div className="t-h2" style={{ fontSize: "1.75rem", color: "var(--text)", lineHeight: 1, margin: "14px 0 4px" }}>
                  {t.price}
                </div>
                <div className="t-meta" style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {t.sub}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 24,
              background: "var(--elevated)",
              border: "1px solid var(--hairline-strong)",
              padding: "24px 28px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <span className="t-lede" style={{ fontSize: "1.125rem", color: "var(--text)" }}>
              Early-pilot — 30% off the first ten practices.
            </span>
            <span
              className="t-meta"
              style={{ fontSize: "0.875rem", letterSpacing: "0.12em", color: "var(--accent-hover)" }}
            >
              10 of 10 pilot seats remaining
            </span>
          </div>
        </Wrap>
      </Section>

      {/* ================ FAQ ================ */}
      <Section tint>
        <Wrap narrow>
          <SectionHead
            num="X."
            eyebrow="— Concierge · FAQ"
            title="Quietly, before the brief."
            lede="The questions that come up most often. Replied to in person within 48 hours if these don't cover it."
          />
          <div style={{ borderTop: "1px solid var(--hairline-strong)" }}>
            {[
              {
                n: "I.",
                q: "Is this AI? Will VerifIQ certify the design?",
                a: "VerifIQ uses AI to read pages and assemble candidate findings. The work is not marketed as AI — the work is a design review aid, performed with the assistance of AI tooling, and gated by a chartered Irish reviewer. We do not certify, sign, or issue a professional opinion. The registered designer does.",
                open: true,
              },
              {
                n: "II.",
                q: "How are large packs handled?",
                a: "Each consultant uploads via magic link to their own discipline gate. The atelier reads up to 600 documents per pack at Tier III. Larger programmes and mega-tier are handled by arrangement. Drawings, specs, and schedules are routed to discipline-specific readers, then through a coordination cross-pass.",
              },
              {
                n: "III.",
                q: "Who reviews the findings before release?",
                a: "During pilot cohort, the founder signs the audit log within his discipline (procurement, contract-form, document hygiene, cross-document coordination). Findings outside that discipline are marked transparently as “pending reviewer sign-off · [discipline]” until the relevant specialist joins. Discipline specialists — RIAI architect, CEng C&S, CEng MEP, FSE — are joining the cohort sequentially.",
              },
              {
                n: "IV.",
                q: "Where is my data held?",
                a: "EU data residency in Dublin region. Documents encrypted at rest. Documents are purged at 14 days; document hashes retained 90 days for abuse prevention; inference logs 30 days. No customer document is used to train any model. The audit log is exportable and yours to keep.",
              },
              {
                n: "V.",
                q: "What sectors are covered?",
                a: "Healthcare, education, offices, residential, civic, heritage, data centres, and major infrastructure. Specialist corpora load per sector — HBN/HTM for healthcare, conservation method standards for heritage, EN 50600 series for data centres. Begin with the onboarding brief and the corpus sets itself.",
              },
              {
                n: "VI.",
                q: "What does the free taster include?",
                a: "One discipline of your choosing, up to 20 documents, counts and severities only, plus one fully-worked finding so you can see the method. The full register is held behind the paywall. One free taster per practice per quarter.",
              },
            ].map((f) => (
              <details
                key={f.n}
                open={f.open}
                style={{ borderBottom: "1px solid var(--hairline-strong)", padding: "24px 0" }}
              >
                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "baseline", gap: 18 }}>
                  <span style={{ fontFamily: "var(--font-serif)", color: "var(--gold)", fontSize: "1.25rem", minWidth: 36 }}>
                    {f.n}
                  </span>
                  <span className="t-h3" style={{ fontSize: "1.0625rem", color: "var(--text)", flex: 1, lineHeight: 1.4 }}>
                    {f.q}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", color: "var(--gold)" }}>+</span>
                </summary>
                <p className="t-body" style={{ margin: "14px 0 0 54px", maxWidth: "64ch" }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Wrap>
      </Section>

      {/* ================ PILOT COHORT CTA ================ */}
      <section
        style={{
          background: "var(--c-ink)",
          color: "var(--c-bone)",
          padding: "96px 0",
          borderTop: "1px solid var(--hairline-strong)",
          borderBottom: "1px solid var(--hairline-strong)",
        }}
      >
        <Wrap narrow style={{ textAlign: "center" }}>
          <span className="t-eyebrow" style={{ color: "var(--c-brass-light)" }}>
            — By Invitation · Pilot
          </span>
          <h2 className="t-h2" style={{ color: "var(--c-bone)", fontSize: "clamp(2rem, 4vw, 3rem)", margin: "16px 0 12px" }}>
            The Pilot Cohort.
          </h2>
          <p className="t-lede" style={{ color: "var(--c-vellum)", fontSize: "1.25rem", maxWidth: "50ch", margin: "0 auto 36px" }}>
            Ten Irish practices, one pack each, working through the atelier this quarter at early-pilot rates.
            Concierge replies in person within 48 hours.
          </p>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            <SheetTagButton code="A-001" label="Request the brief" href="/request" />
            <LeaderButton num="→" label="See pricing" href="#pricing" />
          </div>
          <p
            className="t-meta"
            style={{ color: "var(--c-vellum)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 28 }}
          >
            Dublin · weekdays · 4 packs / week capacity · 10 of 10 pilot seats remaining
          </p>
        </Wrap>
      </section>

      {/* ================ LOCKED DISCLAIMER ================ */}
      <section
        style={{
          padding: "56px 0",
          borderTop: "1px solid var(--hairline-strong)",
          borderBottom: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
          textAlign: "center",
        }}
      >
        <Wrap narrow>
          <span className="t-eyebrow">— Notice · Locked Disclaimer</span>
          <p
            className="t-lede"
            style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--text)", maxWidth: "60ch", margin: "16px auto 24px" }}
          >
            VerifIQ is a software-based reading aid. It surfaces, in the documents&apos; own words, what a
            registered professional may wish to read closely. It does not certify, sign, opine, or substitute
            for professional judgement. The registered designer reads our output, exercises their own
            judgement, verifies locally, and signs. The professional indemnity remains theirs. We carry
            product-quality risk only.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            <Link href="/legal" style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)" }}>
              Legal · per jurisdiction ↗
            </Link>
            <Link href="/legal" style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)" }}>
              Privacy
            </Link>
            <Link href="/legal" style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)" }}>
              Terms
            </Link>
          </div>
        </Wrap>
      </section>
    </MarketingShell>
  );
}

/** Portfolio product card. */
function ProductCard({
  href,
  tag,
  eyebrow,
  title,
  meta,
  body,
  link,
  img,
  alt,
  accent,
  wide = false,
}: {
  href: string;
  tag: string;
  eyebrow: string;
  title: string;
  meta: string;
  body?: string;
  link: string;
  img: string;
  alt: string;
  accent: string;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        border: "1px solid var(--hairline-strong)",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          aspectRatio: wide ? "21 / 8" : "16 / 10",
          overflow: "hidden",
          background: "var(--elevated)",
          borderBottom: "1px solid var(--hairline-strong)",
          position: "relative",
        }}
      >
        <img
          src={img}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)" }}
        />
        <span
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: accent,
            color: "var(--c-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.625rem",
            padding: "6px 10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          {tag}
        </span>
      </div>
      <div style={{ padding: "28px 26px", flex: 1, display: "flex", flexDirection: "column" }}>
        <span className="t-eyebrow" style={{ display: "block" }}>
          {eyebrow}
        </span>
        <h3 className="t-h2" style={{ fontSize: "1.625rem", margin: "10px 0 12px", color: "var(--text)" }}>
          {title}
        </h3>
        <p className="t-meta" style={{ margin: "0 0 18px", color: "var(--text-soft)" }}>
          {meta}
        </p>
        {body && (
          <p className="t-body" style={{ margin: "0 0 24px" }}>
            {body}
          </p>
        )}
        <div style={{ marginTop: "auto" }}>
          <span className="btn-leader">
            <span className="leader-num">→</span>
            <span className="leader-line" aria-hidden />
            <span className="leader-label">{link}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Anonymised reference card. */
function RefCard({
  tag,
  img,
  alt,
  title,
  body,
  stats,
  href,
}: {
  tag: string;
  img: string;
  alt: string;
  title: string;
  body: string;
  stats: { num: string; lab: string }[];
  href?: string;
}) {
  const inner = (
    <article
      style={{
        border: "1px solid var(--hairline-strong)",
        background: "var(--bg)",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          overflow: "hidden",
          background: "var(--elevated)",
          borderBottom: "1px solid var(--hairline-strong)",
          position: "relative",
        }}
      >
        <img src={img} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)" }} />
        <span
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: "var(--c-ink)",
            color: "var(--c-bone)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.625rem",
            padding: "5px 10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          {tag}
        </span>
      </div>
      <div style={{ padding: 24 }}>
        <h4 className="t-h2" style={{ fontSize: "1.25rem", margin: "0 0 12px", lineHeight: 1.2, color: "var(--text)" }}>
          {title}
        </h4>
        <p className="t-body" style={{ fontSize: "0.875rem", margin: "0 0 16px" }}>
          {body}
        </p>
        <div style={{ display: "flex", gap: 18, paddingTop: 14, borderTop: "1px solid var(--hairline-strong)" }}>
          {stats.map((s) => (
            <div key={s.lab}>
              <div className="t-data" style={{ fontSize: "1.5rem", color: "var(--gold)", lineHeight: 1 }}>
                {s.num}
              </div>
              <span
                className="t-meta"
                style={{ letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 4, display: "block" }}
              >
                {s.lab}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
