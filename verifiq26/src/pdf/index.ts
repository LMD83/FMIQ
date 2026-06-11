/**
 * VerifIQ — Node PDF adapters (public surface).
 *
 * Concrete `PdfRenderer` / `TextExtractor` implementations for the title-block
 * classifier (`src/classify/`). Edge-only (pdfjs + napi canvas); see node-pdf.ts.
 *
 * Version: 0.7.0-phase6
 */

export {
  NodePdfAdapter,
  createNodePdf,
  createPdfRenderer,
  createTextExtractor,
  type NodePdfOptions,
} from "./node-pdf.js";
