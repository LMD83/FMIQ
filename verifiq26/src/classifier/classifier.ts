/**
 * VerifIQ — 3-source document classifier (file 20 §3).
 *
 * Combines, in priority order: title-block vision extraction (Source 2, ~80%
 * weight), document content (Source 3, ~60%), and filename (Source 1, fallback).
 * The title-block / content extraction prompts are code-level structured-output
 * wiring (not domain prompts), as with the discipline agents' OUTPUT_INSTRUCTION.
 *
 * The LLM is injected so the filename-only path needs no provider and the LLM
 * paths are unit-testable with a fake client.
 *
 * Version: 0.6.0-phase4
 */

import type { LLMClient } from "../llm/index.js";
import { parseFilename } from "./filename.js";
import {
  type ClassificationInput,
  type ClassificationResult,
  disciplineFromCode,
  inferDocType,
} from "./types.js";

const TITLE_BLOCK_CONFIDENCE = 0.9;
const CONTENT_CONFIDENCE = 0.6;

export interface ClassifierDeps {
  /** Optional — without it, only the filename path runs. */
  llm?: LLMClient;
  corpusVersion?: string;
}

export class TitleBlockClassifier {
  constructor(private readonly deps: ClassifierDeps = {}) {}

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const fromFilename = parseFilename(input.filename);

    // Source 2 — title-block vision extraction (highest weight).
    if (input.titleBlockImage && this.deps.llm) {
      const fields = await this.visionExtract(input.titleBlockImage, input.titleBlockMediaType);
      if (fields?.drawing_number) {
        const discipline =
          disciplineFromCode(fields.discipline_code) ??
          disciplineFromCode(fields.drawing_number?.[0]) ??
          fromFilename.discipline ??
          "Unclassified";
        return this.merge(
          {
            discipline,
            doc_type:
              inferDocType(fields.drawing_title) ?? fromFilename.doc_type ?? "Drawing",
            drawing_number: fields.drawing_number,
            revision: fields.revision ?? fromFilename.revision,
            date: fields.date,
            author: fields.author,
            classifier_confidence: TITLE_BLOCK_CONFIDENCE,
            source: "title-block",
          },
          fromFilename,
        );
      }
    }

    // Source 3 — content classification.
    if (input.contentText && this.deps.llm) {
      const fields = await this.contentClassify(input.contentText);
      if (fields?.discipline) {
        return this.merge(
          {
            discipline: disciplineFromCode(fields.discipline) ?? fields.discipline,
            doc_type: fields.doc_type ?? fromFilename.doc_type ?? "Document",
            drawing_number: fields.drawing_number ?? fromFilename.drawing_number,
            revision: fields.revision ?? fromFilename.revision,
            date: fields.date,
            classifier_confidence: CONTENT_CONFIDENCE,
            source: "content",
          },
          fromFilename,
        );
      }
    }

    // Source 1 — filename fallback.
    return {
      discipline: fromFilename.discipline ?? "Unclassified",
      doc_type: fromFilename.doc_type ?? "Document",
      ...(fromFilename.drawing_number ? { drawing_number: fromFilename.drawing_number } : {}),
      ...(fromFilename.revision ? { revision: fromFilename.revision } : {}),
      classifier_confidence: fromFilename.confidence,
      source: "filename",
    };
  }

  private merge(
    result: ClassificationResult,
    fallback: ReturnType<typeof parseFilename>,
  ): ClassificationResult {
    // Drop undefined optionals; backfill drawing_number/revision from filename.
    const out: ClassificationResult = {
      discipline: result.discipline,
      doc_type: result.doc_type,
      classifier_confidence: result.classifier_confidence,
      source: result.source,
    };
    const drawing = result.drawing_number ?? fallback.drawing_number;
    const revision = result.revision ?? fallback.revision;
    if (drawing) out.drawing_number = drawing;
    if (revision) out.revision = revision;
    if (result.date) out.date = result.date;
    if (result.author) out.author = result.author;
    return out;
  }

  private async visionExtract(
    image: Uint8Array,
    mediaType: ClassificationInput["titleBlockMediaType"],
  ): Promise<TitleBlockFields | null> {
    void mediaType;
    try {
      const res = await this.deps.llm!.completeVision(
        "title-block-extraction",
        image,
        TITLE_BLOCK_PROMPT,
        { agentId: "classifier-title-block", corpusVersion: this.deps.corpusVersion },
      );
      return parseObject<TitleBlockFields>(res.text);
    } catch {
      return null;
    }
  }

  private async contentClassify(text: string): Promise<ContentFields | null> {
    try {
      const res = await this.deps.llm!.complete(
        "classification",
        `${CONTENT_PROMPT}\n\n---\n${text.slice(0, 4000)}`,
        { agentId: "classifier-content", corpusVersion: this.deps.corpusVersion },
      );
      return parseObject<ContentFields>(res.text);
    } catch {
      return null;
    }
  }
}

export function createClassifier(deps: ClassifierDeps = {}): TitleBlockClassifier {
  return new TitleBlockClassifier(deps);
}

// ── prompts (code-level output wiring) + parsing ──────────────────────────────

interface TitleBlockFields {
  drawing_title?: string;
  drawing_number?: string;
  revision?: string;
  date?: string;
  scale?: string;
  discipline_code?: string;
  author?: string;
}

interface ContentFields {
  discipline?: string;
  doc_type?: string;
  drawing_number?: string;
  revision?: string;
  date?: string;
}

const TITLE_BLOCK_PROMPT = [
  "This image is the bottom-right title block of a construction drawing.",
  "Read the fields and return ONLY a JSON object (no prose, no code fence) with keys:",
  "drawing_title, drawing_number, revision, date, scale, discipline_code, author.",
  "discipline_code is the single-letter code (A architecture, S structural, M mechanical,",
  "E electrical, C civil, F fire). Use null for any field you cannot read.",
].join(" ");

const CONTENT_PROMPT = [
  "Classify the construction document from the text below. Return ONLY a JSON object",
  "(no prose, no code fence) with keys: discipline, doc_type, drawing_number, revision, date.",
  "discipline is one of: Architectural, Structural, Mechanical, Electrical, Civil, Fire,",
  "Public Health, Landscape. Use null for anything not present.",
].join(" ");

function parseObject<T>(text: string): T | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  if (!t.startsWith("{")) {
    const obj = t.match(/\{[\s\S]*\}/);
    if (obj) t = obj[0];
  }
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    // Normalise JSON null → undefined so callers can use ?? cleanly.
    for (const k of Object.keys(parsed)) if (parsed[k] === null) delete parsed[k];
    return parsed as T;
  } catch {
    return null;
  }
}
