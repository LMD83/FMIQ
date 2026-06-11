/**
 * VerifIQ — Node PDF adapters (concrete PdfRenderer / TextExtractor).
 *
 * The classify core (`src/classify/`) is deliberately runtime-agnostic: it takes
 * the title-block raster and first-page text through injected ports so it stays
 * unit-testable and bundleable. This module is the *edge* implementation of
 * those ports for a Node runtime — it pulls in the heavy `pdfjs-dist` parser and
 * the `@napi-rs/canvas` rasteriser, which only load on first use.
 *
 *   - `firstText`  → pdfjs `getTextContent` of page 1, joined and clamped.
 *   - `renderFirstPagePng` → pdfjs renders page 1 onto a napi canvas → PNG, for
 *     the title-block vision model.
 *
 * pdfjs runs in main-thread (no-worker) mode in Node; `disableWorker` avoids the
 * fake-worker `structuredClone` path that is broken on current Node. Standard-14
 * fonts and cMaps are wired from the installed package so real packs (embedded
 * or base-14 fonts, CJK title blocks) rasterise correctly.
 *
 * Spec references: verifiq-prompts/20_platform_architecture.md § 3 (classifier);
 * `src/classify/types.ts` (the ports); CLAUDE.md Phase 6.
 * Version: 0.7.0-phase6
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { type PdfRenderer, type TextExtractor } from "../classify/types.js";

/** Default raster scale for the first-page render (~150 DPI at A-series). */
const DEFAULT_RENDER_SCALE = 2.0;

/** Hard ceiling on render dimensions so a poster-size sheet can't OOM a worker. */
const MAX_RENDER_DIMENSION = 4000;

export interface NodePdfOptions {
  /** Raster scale for `renderFirstPagePng` (default 2.0). Clamped by area. */
  renderScale?: number;
}

// pdfjs ships ESM; the legacy build is the Node-targeted entry. Type it from the
// adjacent `pdf.d.mts` via a dynamic-import type so this module carries no
// top-level pdfjs import (keeps the parser out of bundles that never render).
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type CanvasModule = typeof import("@napi-rs/canvas");

const require_ = createRequire(import.meta.url);

let pdfjsPromise: Promise<PdfjsModule> | null = null;
let canvasPromise: Promise<CanvasModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  return (pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
}

function loadCanvas(): Promise<CanvasModule> {
  return (canvasPromise ??= import("@napi-rs/canvas"));
}

/** Directory (with trailing separator) of an asset folder inside pdfjs-dist. */
function pdfjsAssetDir(folder: string): string {
  const pkg = require_.resolve("pdfjs-dist/package.json");
  return join(dirname(pkg), folder) + "/";
}

/** Shared loader params: no worker, fonts + cMaps wired from the package. */
function documentParams(bytes: Uint8Array): Record<string, unknown> {
  return {
    // pdfjs may detach the buffer it is given; hand it a private copy so the
    // caller's bytes (often reused across classify sources) stay intact.
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    standardFontDataUrl: pdfjsAssetDir("standard_fonts"),
    cMapUrl: pdfjsAssetDir("cmaps"),
    cMapPacked: true,
  };
}

/**
 * Concrete Node implementation of both classify ports. One instance satisfies
 * `PdfRenderer` and `TextExtractor`, so it can be passed to both classifier
 * dependency slots.
 */
export class NodePdfAdapter implements PdfRenderer, TextExtractor {
  private readonly scale: number;

  constructor(opts: NodePdfOptions = {}) {
    this.scale = opts.renderScale && opts.renderScale > 0 ? opts.renderScale : DEFAULT_RENDER_SCALE;
  }

  async firstText(bytes: Uint8Array, maxChars: number): Promise<string> {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument(documentParams(bytes));
    const doc = await task.promise;
    try {
      const page = await doc.getPage(1);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue; // skip TextMarkedContent markers
        text += item.str;
        if (item.hasEOL) text += "\n";
        else text += " ";
        if (text.length >= maxChars) break;
      }
      return text.slice(0, maxChars).trim();
    } finally {
      await task.destroy();
    }
  }

  async renderFirstPagePng(bytes: Uint8Array): Promise<Uint8Array> {
    const [pdfjs, canvasMod] = await Promise.all([loadPdfjs(), loadCanvas()]);
    const task = pdfjs.getDocument(documentParams(bytes));
    const doc = await task.promise;
    try {
      const page = await doc.getPage(1);
      const scale = this.fitScale(page.getViewport({ scale: 1 }));
      const viewport = page.getViewport({ scale });
      const canvas = canvasMod.createCanvas(
        Math.max(1, Math.ceil(viewport.width)),
        Math.max(1, Math.ceil(viewport.height)),
      );
      const ctx = canvas.getContext("2d");
      await page.render({
        // napi-canvas' 2D context is API-compatible with the DOM type pdfjs
        // expects; the structural cast keeps tsc honest without `any`.
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      return new Uint8Array(canvas.toBuffer("image/png"));
    } finally {
      await task.destroy();
    }
  }

  /** Clamp the configured scale so neither dimension exceeds the safety cap. */
  private fitScale(unit: { width: number; height: number }): number {
    const longest = Math.max(unit.width, unit.height) * this.scale;
    if (longest <= MAX_RENDER_DIMENSION) return this.scale;
    return this.scale * (MAX_RENDER_DIMENSION / longest);
  }
}

/** Build an adapter that satisfies both classify ports. */
export function createNodePdf(opts?: NodePdfOptions): NodePdfAdapter {
  return new NodePdfAdapter(opts);
}

/** Title-block raster source for the classifier (`PdfRenderer`). */
export function createPdfRenderer(opts?: NodePdfOptions): PdfRenderer {
  return new NodePdfAdapter(opts);
}

/** First-page text source for the classifier (`TextExtractor`). */
export function createTextExtractor(opts?: NodePdfOptions): TextExtractor {
  return new NodePdfAdapter(opts);
}
