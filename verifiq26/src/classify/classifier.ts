/**
 * VerifIQ — 3-source document classifier (file 20 §3).
 *
 * Combines three signals, weighted: title-block vision (0.8 when a drawing
 * number is extracted cleanly) > first-500-char content (0.6) > filename (~0.3).
 * Vision and text extraction are injected (PdfRenderer / TextExtractor) so this
 * stays testable without the pdf toolchain.
 *
 * Version: 0.6.0-phase4
 */

import type { LLMClient } from "../llm/index.js";
import {
  DISCIPLINE_BY_CODE,
  type ClassificationResult,
  type ClassifyInput,
  type PdfRenderer,
  type TextExtractor,
} from "./types.js";
import { inferDocType, parseFilename } from "./filename.js";

export interface ClassifierDeps {
  llm: LLMClient;
  renderer?: PdfRenderer;
  textExtractor?: TextExtractor;
}

const CONTENT_CHARS = 2000; // ~first 500 tokens

/** Classify one document by combining the three sources. */
export async function classifyDocument(
  input: ClassifyInput,
  deps: ClassifierDeps,
): Promise<ClassificationResult> {
  const filenameResult = parseFilename(input.filename);

  // Source 2 — title-block vision (highest weight when it yields a number).
  if (input.bytes && deps.renderer) {
    try {
      const png = await deps.renderer.renderFirstPagePng(input.bytes);
      const fields = await extractTitleBlock(deps.llm, png);
      if (fields && fields.drawing_number) {
        return mergeTitleBlock(fields, filenameResult);
      }
    } catch {
      // fall through to content / filename
    }
  }

  // Source 3 — first-500-token content.
  const text =
    input.firstPageText ??
    (input.bytes && deps.textExtractor
      ? await deps.textExtractor.firstText(input.bytes, CONTENT_CHARS).catch(() => "")
      : "");
  if (text.trim().length > 0) {
    const content = await classifyContent(deps.llm, text);
    if (content && content.discipline !== "unsorted") {
      return {
        discipline: content.discipline,
        doc_type: content.doc_type || filenameResult.doc_type,
        drawing_number: filenameResult.drawing_number,
        revision: filenameResult.revision,
        classifier_confidence: 0.6,
        source: "content",
      };
    }
  }

  // Source 1 — filename fallback.
  return filenameResult;
}

interface TitleBlockFields {
  drawing_title?: string;
  drawing_number?: string;
  revision?: string;
  date?: string;
  discipline_code?: string;
  author?: string;
}

const TITLE_BLOCK_PROMPT = [
  "Read this drawing title block and return ONLY JSON with these keys:",
  "drawing_title, drawing_number, revision, date, scale, discipline_code, author, project_ref.",
  "discipline_code is the single-letter code (A/S/M/E/C/F/L/Q). Use null for any field not shown.",
].join(" ");

async function extractTitleBlock(
  llm: LLMClient,
  png: Uint8Array,
): Promise<TitleBlockFields | null> {
  const res = await llm.completeVision("title-block-extraction", png, TITLE_BLOCK_PROMPT, {
    agentId: "title-block",
  });
  return parseJson<TitleBlockFields>(res.text);
}

function mergeTitleBlock(
  fields: TitleBlockFields,
  filenameResult: ClassificationResult,
): ClassificationResult {
  const code = fields.discipline_code?.trim().toUpperCase();
  const discipline =
    (code && DISCIPLINE_BY_CODE[code]) || filenameResult.discipline;
  return {
    discipline,
    doc_type: fields.drawing_title ? inferDocType(fields.drawing_title) : filenameResult.doc_type,
    drawing_number: fields.drawing_number ?? filenameResult.drawing_number,
    revision: fields.revision ?? filenameResult.revision,
    date: fields.date,
    author: fields.author,
    classifier_confidence: code && DISCIPLINE_BY_CODE[code] ? 0.9 : 0.8,
    source: "title-block",
  };
}

const CONTENT_PROMPT = (text: string) =>
  [
    "Classify this construction document by discipline and type. Return ONLY JSON:",
    '{"discipline": "architectural|structural|mechanical|electrical|civil|fire|quantity-surveying|unsorted",',
    '"doc_type": "drawing|specification|schedule|report|bill-of-quantities|unknown"}.',
    "",
    "Document text:",
    text.slice(0, CONTENT_CHARS),
  ].join("\n");

async function classifyContent(
  llm: LLMClient,
  text: string,
): Promise<{ discipline: string; doc_type: string } | null> {
  const res = await llm.complete("classification", CONTENT_PROMPT(text), { agentId: "classifier" });
  return parseJson<{ discipline: string; doc_type: string }>(res.text);
}

function parseJson<T>(text: string): T | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
