import type { Metadata } from "next";
import { MarketingShell, Wrap, Section } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Sub-processors — VerifIQ",
  description:
    "The third-party sub-processors VerifIQ uses to deliver the service. Published transparently per GDPR Article 28.",
};

type Row = {
  name: string;
  domain: string;
  purpose: string;
  dataType: string;
  region: string;
  dpa: string;
};

const rows: Row[] = [
  {
    name: "Anthropic",
    domain: "anthropic.com",
    purpose:
      "AI inference — primary model (Claude Sonnet, Haiku). Reads documents to surface candidate findings.",
    dataType: "Pack content (during inference) · prompt + response logs",
    region: "EU (Ireland)",
    dpa: "https://www.anthropic.com/legal/dpa",
  },
  {
    name: "OpenAI",
    domain: "openai.com",
    purpose:
      "AI inference — fallback model (GPT-4 class). Used only when primary provider is unavailable.",
    dataType: "Pack content (during inference) · prompt + response logs",
    region: "EU",
    dpa: "https://openai.com/policies/eu-data-processing-addendum",
  },
  {
    name: "Convex",
    domain: "convex.dev",
    purpose:
      "Application database, file storage, and authentication (Convex Auth). Holds pack manifests, findings, audit logs, reviewer state, and user sessions.",
    dataType: "Customer data · pack content · findings · audit log · user identity",
    region: "EU-West (Dublin)",
    dpa: "https://www.convex.dev/legal/dpa",
  },
  {
    name: "Vercel",
    domain: "vercel.com",
    purpose: "Frontend hosting. Serves verifiq.ie.",
    dataType: "HTTP request metadata",
    region: "EU edge",
    dpa: "https://vercel.com/legal/dpa",
  },
  {
    name: "Stripe",
    domain: "stripe.com",
    purpose: "Payments processing + Stripe Tax (VAT). Recurring + one-off billing.",
    dataType: "Billing identity · payment instrument metadata · VAT info",
    region: "EU (Ireland)",
    dpa: "https://stripe.com/legal/dpa",
  },
  {
    name: "Resend",
    domain: "resend.com",
    purpose: "Transactional email — welcome, scan complete, paid release, audit log link.",
    dataType: "User email address · email content",
    region: "EU",
    dpa: "https://resend.com/legal/dpa",
  },
  {
    name: "Plausible Analytics",
    domain: "plausible.io",
    purpose: "Website analytics — cookie-free, no personal data, EU-hosted.",
    dataType: "Aggregated traffic metadata (no personal data)",
    region: "EU (Frankfurt)",
    dpa: "https://plausible.io/dpa",
  },
];

const cellStyle: React.CSSProperties = {
  padding: "16px 18px",
  textAlign: "left",
  border: "1px solid var(--hairline-strong)",
  verticalAlign: "top",
};

const thStyle: React.CSSProperties = {
  ...cellStyle,
  background: "var(--elevated)",
  color: "var(--text)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.6875rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

export default function SubProcessorsPage() {
  return (
    <MarketingShell>
      <header style={{ padding: "64px 0 40px", borderBottom: "1px solid var(--hairline-strong)" }}>
        <Wrap>
          <span className="t-eyebrow">— Drawing 11 · Data processing chain</span>
          <h1 className="t-display" style={{ margin: "14px 0 8px" }}>
            Sub-processors.
          </h1>
          <p className="t-lede" style={{ maxWidth: "60ch", fontStyle: "italic" }}>
            VerifIQ is built on third-party services. The list below names every sub-processor that
            handles personal data or pack content, the purpose, the data type, and where it resides.
            Updated on every material change.
          </p>
        </Wrap>
      </header>

      <Section>
        <Wrap>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid var(--hairline-strong)",
            }}
          >
            <thead>
              <tr>
                <th className="t-meta" style={thStyle}>
                  Sub-processor
                </th>
                <th className="t-meta" style={thStyle}>
                  Purpose
                </th>
                <th className="t-meta" style={thStyle}>
                  Data type
                </th>
                <th className="t-meta" style={thStyle}>
                  Region
                </th>
                <th className="t-meta" style={thStyle}>
                  DPA
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={cellStyle}>
                    <div className="t-body" style={{ fontWeight: 500 }}>
                      {r.name}
                    </div>
                    <div className="t-meta" style={{ color: "var(--text-muted)" }}>
                      {r.domain}
                    </div>
                  </td>
                  <td className="t-body" style={{ ...cellStyle, color: "var(--text-soft)" }}>
                    {r.purpose}
                  </td>
                  <td className="t-body" style={{ ...cellStyle, color: "var(--text-soft)" }}>
                    {r.dataType}
                  </td>
                  <td className="t-meta" style={{ ...cellStyle, color: "var(--text-muted)" }}>
                    {r.region}
                  </td>
                  <td className="t-meta" style={{ ...cellStyle, color: "var(--text-muted)" }}>
                    <a href={r.dpa} style={{ color: "var(--accent)" }}>
                      DPA ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              marginTop: 48,
              padding: "32px 28px",
              background: "var(--surface)",
              border: "1px solid var(--hairline-strong)",
            }}
          >
            <h3 className="t-h3" style={{ margin: "0 0 12px" }}>
              What we do &mdash; and what we do not do &mdash; with customer data.
            </h3>
            <p className="t-body" style={{ color: "var(--text-soft)", margin: "0 0 10px" }}>
              <strong style={{ color: "var(--text)" }}>We do:</strong> process customer documents
              through Anthropic and OpenAI APIs solely to produce the source-quoted findings register
              that is the contracted deliverable. We hold the pack in encrypted Convex storage for the
              duration of the engagement, plus a maximum of 14 days post-release.
            </p>
            <p className="t-body" style={{ color: "var(--text-soft)", margin: "0 0 10px" }}>
              <strong style={{ color: "var(--text)" }}>We do not:</strong> train any AI model on
              customer documents. We do not sell or share customer data with third parties not listed
              above. Hashes of files are retained for 90 days for abuse prevention; this is the only
              customer-data retention beyond 14 days.
            </p>
            <p className="t-body" style={{ color: "var(--text-soft)", margin: "0 0 10px" }}>
              <strong style={{ color: "var(--text)" }}>We will tell you:</strong> if we materially
              change this sub-processor list, you will be notified by email at least 30 days before
              the change takes effect. You may terminate your engagement on the change date with
              pro-rated refund if you object.
            </p>
          </div>
        </Wrap>
      </Section>

      <Section tint>
        <Wrap narrow style={{ textAlign: "center" }}>
          <span className="t-eyebrow">— Notice · Locked disclaimer</span>
          <p
            className="t-lede"
            style={{
              fontStyle: "italic",
              lineHeight: 1.7,
              color: "var(--text)",
              maxWidth: "58ch",
              margin: "14px auto",
            }}
          >
            VerifIQ is a software-based reading aid. It surfaces, in the documents&rsquo; own words,
            what a registered professional may wish to read closely. It does not certify, sign,
            opine, or substitute for professional judgement. The registered designer reads our
            output, exercises their own judgement, verifies locally, and signs. The professional
            indemnity remains theirs. We carry product-quality risk only.
          </p>
        </Wrap>
      </Section>
    </MarketingShell>
  );
}
