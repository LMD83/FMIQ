// @vitest-environment node
/**
 * VerifIQ — Node PDF adapter tests (Phase 6).
 *
 * Exercises the concrete PdfRenderer / TextExtractor against an in-test,
 * byte-deterministic single-page PDF (no committed binary fixture): text
 * extraction returns the planted title-block string and honours the char
 * budget; the renderer produces a valid PNG with sane dimensions. Runs in the
 * Node environment (pdfjs + @napi-rs/canvas are native/edge-only).
 *
 * Version: 0.7.0-phase6
 */

import { describe, it, expect } from "vitest";
import { NodePdfAdapter, createPdfRenderer, createTextExtractor } from "../src/pdf/index.js";

/** Build a minimal, valid single-page PDF whose content stream draws `text`. */
function makePdf(text: string): Uint8Array {
  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R " +
      "/Resources << /Font << /F1 5 0 R >> >> >>",
    "", // contents — filled below
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
  bodies[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  bodies.forEach((body, i) => {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += String(off).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

const PLANTED = "VERIFIQ TEST A-101 Rev P1";

function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

describe("NodePdfAdapter", () => {
  it("extracts first-page text from a real PDF", async () => {
    const extractor = createTextExtractor();
    const text = await extractor.firstText(makePdf(PLANTED), 500);
    expect(text).toContain("VERIFIQ TEST");
    expect(text).toContain("A-101");
    expect(text).toContain("Rev P1");
  });

  it("honours the maxChars budget", async () => {
    const extractor = createTextExtractor();
    const text = await extractor.firstText(makePdf(PLANTED), 6);
    expect(text.length).toBeLessThanOrEqual(6);
  });

  it("does not detach the caller's bytes", async () => {
    const bytes = makePdf(PLANTED);
    const len = bytes.length;
    await createTextExtractor().firstText(bytes, 500);
    expect(bytes.length).toBe(len); // buffer survived (we copy before pdfjs)
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("renders the first page to a valid PNG", async () => {
    const renderer = createPdfRenderer({ renderScale: 2 });
    const png = await renderer.renderFirstPagePng(makePdf(PLANTED));
    expect(isPng(png)).toBe(true);
    expect(png.length).toBeGreaterThan(100);
  });

  it("one adapter satisfies both classify ports", async () => {
    const adapter = new NodePdfAdapter();
    const [text, png] = await Promise.all([
      adapter.firstText(makePdf(PLANTED), 100),
      adapter.renderFirstPagePng(makePdf(PLANTED)),
    ]);
    expect(text).toContain("A-101");
    expect(isPng(png)).toBe(true);
  });
});
