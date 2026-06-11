"use node";

/**
 * VerifIQ — PDF Extraction Helpers
 *
 * Text extraction via pdf-parse (fast, no rendering)
 * Image extraction via pdf2pic (for vision-based drawing checks)
 *
 * Page-range targeting: avoid reading entire files when only a few pages matter.
 * Used by the per-discipline scan orchestrator.
 */

export async function extractPdfText(
  ctx: any,
  storageId: string,
  estimatedPages: number
): Promise<string> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) return "";

  const buffer = Buffer.from(await blob.arrayBuffer());
  const pdfParse = require("pdf-parse");

  try {
    // For specs / schedules, read everything (caller handles chunking)
    const data = await pdfParse(buffer);
    return insertPageMarkers(data.text);
  } catch (e) {
    console.warn(`PDF text extraction failed for ${storageId}:`, e);
    return "";
  }
}

export async function extractPdfTextRange(
  ctx: any,
  storageId: string,
  startPage: number,
  endPage: number
): Promise<string> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) return "";

  const buffer = Buffer.from(await blob.arrayBuffer());
  const pdfParse = require("pdf-parse");

  try {
    const data = await pdfParse(buffer, { max: endPage });
    // pdf-parse doesn't support startPage natively; we slice on page-break markers
    const text = insertPageMarkers(data.text);
    const pages = text.split(/\n--- Page (\d+) ---\n/);
    let result = "";
    for (let i = 1; i < pages.length; i += 2) {
      const pageNum = parseInt(pages[i], 10);
      if (pageNum >= startPage && pageNum <= endPage) {
        result += `\n--- Page ${pageNum} ---\n` + pages[i + 1];
      }
    }
    return result;
  } catch (e) {
    console.warn(`PDF range extraction failed:`, e);
    return "";
  }
}

export async function extractPdfImages(
  ctx: any,
  storageId: string,
  estimatedPages: number
): Promise<Array<{ page: number; base64: string }>> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) return [];

  const buffer = Buffer.from(await blob.arrayBuffer());

  // Production: use pdf2pic or pdf-poppler to render each page to PNG
  // POC stub — returns empty (orchestrator handles fallback to text-only for drawings)
  try {
    const { fromBuffer } = require("pdf2pic");
    const converter = fromBuffer(buffer, {
      density: 100,
      format: "png",
      width: 1600,
      height: 1200,
    });

    const images: Array<{ page: number; base64: string }> = [];
    const pageCap = Math.min(estimatedPages, 8);

    for (let page = 1; page <= pageCap; page++) {
      const result = await converter(page, { responseType: "base64" });
      if (result?.base64) {
        images.push({ page, base64: result.base64 });
      }
    }
    return images;
  } catch (e) {
    console.warn(`PDF image extraction failed:`, e);
    return [];
  }
}

function insertPageMarkers(text: string): string {
  // pdf-parse separates pages with form-feed (\f). Convert to readable markers.
  const pages = text.split(/\f/);
  return pages
    .map((page, i) => `\n--- Page ${i + 1} ---\n${page.trim()}`)
    .join("\n");
}
