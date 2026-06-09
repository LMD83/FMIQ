/**
 * VerifIQ — PDF extraction tests (Phase 5).
 *
 * Exercises the extractor with an injected fake parse (no pdf-parse, no real
 * PDF): text normalisation, empty-buffer guard, the 500-token content window,
 * and the extraction → ClassifyInput shaping that feeds the classifier.
 *
 * Version: 0.8.0-phase5
 */

import { describe, it, expect } from "vitest";
import {
  PdfTextExtractor,
  firstTokens,
  normaliseWhitespace,
  extractionToInput,
  type RawPdfParse,
} from "../src/extraction/index.js";

const fakeParse =
  (text: string, pageCount = 1): RawPdfParse =>
  async () =>
    ({ text, pageCount });

describe("PdfTextExtractor", () => {
  it("extracts and normalises page text via the injected parser", async () => {
    const extractor = new PdfTextExtractor(fakeParse("Drawing  A-101 \r\n  Ground Floor Plan ", 3));
    const out = await extractor.extract(new Uint8Array([1, 2, 3]));
    expect(out.pageCount).toBe(3);
    expect(out.text).toBe("Drawing  A-101\n  Ground Floor Plan");
  });

  it("rejects an empty buffer", async () => {
    await expect(new PdfTextExtractor(fakeParse("x")).extract(new Uint8Array())).rejects.toThrow(
      /Empty PDF/,
    );
  });

  it("rejects an oversized buffer before parsing", async () => {
    const extractor = new PdfTextExtractor(fakeParse("x"), { maxBytes: 4 });
    await expect(extractor.extract(new Uint8Array(8))).rejects.toThrow(/too large/);
  });

  it("aborts a parse that exceeds the timeout", async () => {
    const slowParse: RawPdfParse = () => new Promise(() => {}); // never resolves
    const extractor = new PdfTextExtractor(slowParse, { timeoutMs: 10 });
    await expect(extractor.extract(new Uint8Array([1]))).rejects.toThrow(/timed out/);
  });
});

describe("firstTokens", () => {
  it("keeps only the first n tokens", () => {
    const text = Array.from({ length: 600 }, (_, i) => `t${i}`).join(" ");
    expect(firstTokens(text, 500).split(" ")).toHaveLength(500);
    expect(firstTokens("a   b\nc")).toBe("a b c");
  });
});

describe("normaliseWhitespace", () => {
  it("collapses CRLF and trailing spaces and trims", () => {
    expect(normaliseWhitespace("  a \r\nb  \n")).toBe("a\nb");
  });
});

describe("extractionToInput", () => {
  it("shapes an extraction into a ClassifyInput (Source 3 first-page text)", () => {
    const input = extractionToInput(
      "A-101-Ground-Floor.pdf",
      { text: "Architectural general arrangement plan", pageCount: 1 },
      { contentTokens: 3 },
    );
    expect(input.filename).toBe("A-101-Ground-Floor.pdf");
    expect(input.firstPageText).toBe("Architectural general arrangement"); // first 3 tokens
  });
});
