/**
 * VerifIQ — small LLM-adapter utilities.
 * Version: 0.3.0-phase1
 */

/** SHA-256 hex of a string (Web Crypto; Node 20 + edge runtimes). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Base64-encode bytes; works under Node and edge/web runtimes. */
export function toBase64(bytes: Uint8Array): string {
  const maybeBuffer = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } })
    .Buffer;
  if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // btoa is available in web/edge runtimes.
  return btoa(binary);
}
