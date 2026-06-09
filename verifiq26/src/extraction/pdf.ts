/**
 * VerifIQ — PDF text extractor (Phase 5, file 20 §1).
 *
 * Wraps an injected raw PDF parse into the `PdfExtractor` port and shapes the
 * result into the classifier's `ClassifyInput` (first-page text = first ~500
 * tokens, Source 3). The default parse binds the optional `pdf-parse` package via
 * a non-literal dynamic import, so `tsc`/CI don't require the dependency to be
 * installed; install it (or inject a `RawPdfParse`) to enable server extraction.
 *
 * Version: 0.8.0-phase5
 */

import type { ClassifyInput } from "../classify/index.js";
import type { PdfExtraction, PdfExtractor, RawPdfParse } from "./types.js";

/** Default content window handed to the classifier (Source 3). */
const DEFAULT_CONTENT_TOKENS = 500;
/** Resource bounds applied before/around parsing (defence-in-depth, file 20 §1). */
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_TIMEOUT_MS = 30_000;

export interface PdfExtractorOptions {
  /** Reject inputs larger than this before parsing (0 disables). */
  maxBytes?: number;
  /** Abort the parse if it exceeds this many ms (0 disables). */
  timeoutMs?: number;
}

/** Bind `pdf-parse` lazily; throws an actionable error when it isn't installed. */
export const defaultPdfParse: RawPdfParse = async (bytes) => {
  // Non-literal specifier → tsc treats the import as `any` and does not require
  // the optional dependency at build time (it's wired in the live environment).
  const moduleName = "pdf-parse";
  let mod: { default: (b: Uint8Array) => Promise<{ text?: string; numpages?: number }> };
  try {
    mod = (await import(moduleName)) as typeof mod;
  } catch {
    throw new Error("pdf-parse is not installed — run `npm i pdf-parse`, or inject a RawPdfParse");
  }
  const parsed = await mod.default(Buffer.from(bytes));
  return { text: parsed.text ?? "", pageCount: parsed.numpages ?? 0 };
};

export class PdfTextExtractor implements PdfExtractor {
  private readonly maxBytes: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly parse: RawPdfParse = defaultPdfParse,
    options: PdfExtractorOptions = {},
  ) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async extract(bytes: Uint8Array): Promise<PdfExtraction> {
    if (!bytes || bytes.length === 0) throw new Error("Empty PDF buffer");
    if (this.maxBytes > 0 && bytes.length > this.maxBytes) {
      throw new Error(`PDF too large: ${bytes.length} bytes (max ${this.maxBytes})`);
    }
    const { text, pageCount } = await this.withTimeout(this.parse(bytes));
    return { text: normaliseWhitespace(text), pageCount };
  }

  /** Race the parse against the configured timeout (disabled when 0). */
  private withTimeout<T>(work: Promise<T>): Promise<T> {
    if (this.timeoutMs <= 0) return work;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`PDF parse timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
      work.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }
}

/** First `n` whitespace-delimited tokens of the text (the classifier's window). */
export function firstTokens(text: string, n = DEFAULT_CONTENT_TOKENS): string {
  return text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

/** Normalise line endings and trailing whitespace from extracted text. */
export function normaliseWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

/** Build the classifier input (Source 3 first-page text) from an extraction. */
export function extractionToInput(
  filename: string,
  extraction: PdfExtraction,
  opts: { contentTokens?: number } = {},
): ClassifyInput {
  return {
    filename,
    firstPageText: firstTokens(extraction.text, opts.contentTokens),
  };
}
