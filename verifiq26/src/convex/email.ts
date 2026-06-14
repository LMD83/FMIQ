/**
 * VerifIQ — transactional email send (Resend).
 *
 * Sprint 1 path: the "Your secure upload link" email (docs/18 voice, docs/42
 * §5.3 B3). Kept deliberately thin and dependency-free — a `fetch` to Resend's
 * REST API, available in the Convex action runtime and Node 20+ alike, so no
 * SDK and no new package are pulled in.
 *
 * If `RESEND_API_KEY` is unset (offline dev / `convex dev` without secrets) the
 * send is a no-op that reports `{ sent: false }` rather than throwing — so the
 * intake flow still creates the project + code and stays testable. The raw code
 * is NEVER logged or returned over HTTP; it travels only inside this email.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Locked disclaimer footer (docs/18) — appended to every transactional email. */
const DISCLAIMER =
  "VerifIQ is a software-based reading aid. It does not certify, sign, opine, " +
  "or substitute for professional judgement. The registered designer verifies " +
  "locally and retains all professional responsibility.";

export interface UploadLinkEmail {
  to: string;
  name: string;
  projectName: string;
  /** One-click magic link, e.g. https://app.verifiq.ie/upload?code=… */
  link: string;
  /** Human fallback code (D4) for when the link is mangled / spam-binned. */
  code: string;
}

/** Plain-text body for the upload-link email (docs/18 sober founder voice). */
export function renderUploadLinkEmail(e: UploadLinkEmail): string {
  return [
    `Hi ${e.name},`,
    "",
    `Your VerifIQ upload link for ${e.projectName} is ready. Open it and drag`,
    "your pack straight in — it uploads directly, resumes if your connection",
    "drops, and the read starts the moment the last file lands.",
    "",
    `Upload your pack:  ${e.link}`,
    "",
    `If the link doesn't open, go to the upload page and enter this code: ${e.code}`,
    "",
    "The link is single-use and expires in 72 hours. If it lapses, just request",
    "a new one from the site.",
    "",
    "— Liam",
    "Founder, VerifIQ (a GovIQ Ltd product)",
    "",
    "— — —",
    DISCLAIMER,
  ].join("\n");
}

/**
 * Send the upload-link email. Returns `{ sent: false }` (never throws) when the
 * API key is absent or Resend rejects the request, so a delivery failure parks
 * the intake rather than 500-ing the whole request.
 */
export async function sendUploadLinkEmail(e: UploadLinkEmail): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };
  const from = process.env.EMAIL_FROM ?? "VerifIQ <hello@verifiq.ie>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [e.to],
        subject: "Your secure VerifIQ upload link",
        text: renderUploadLinkEmail(e),
      }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}
