/**
 * VerifIQ — browser-side direct-upload helpers (docs/42 §5.2, Sprint 2).
 *
 * Pure, dependency-free client utilities used by the `/upload` route: a
 * Web-Crypto SHA-256 (the per-file digest sent to `registerUploadedDocument`),
 * a human byte formatter, the discipline vocabulary for the file tagger, and a
 * progress-reporting PUT to a signed URL. No imports from `r2.ts` — this file
 * never pulls the AWS SDK into the browser bundle.
 */

/** Disciplines a customer can tag a file with at upload (MVP-level; docs/42 A5). */
export const UPLOAD_DISCIPLINES = [
  "architectural",
  "fire",
  "access",
  "mechanical-electrical",
  "structural",
  "civil",
  "qs",
  "unclassified",
] as const;

export type UploadDiscipline = (typeof UPLOAD_DISCIPLINES)[number];

/** Lower-case hex SHA-256 of any byte source (Web Crypto; browser + edge). */
export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 of a File/Blob, read fully into memory. */
export async function sha256OfBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer());
}

/** Human-readable byte size, e.g. 1536 → "1.5 KB", 0 → "0 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

export interface PutOptions {
  method?: "PUT" | "POST";
  contentType?: string;
  /** Called with upload fraction in [0, 1] as bytes flush. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * PUT a blob to a signed URL with progress. Uses XMLHttpRequest because `fetch`
 * does not expose upload progress in browsers. Resolves on 2xx, rejects otherwise.
 */
export function putToSignedUrl(url: string, blob: Blob, opts: PutOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "PUT", url);
    if (opts.contentType) xhr.setRequestHeader("Content-Type", opts.contentType);
    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress!(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("upload failed: HTTP " + xhr.status));
    };
    xhr.onerror = () => reject(new Error("network error during upload"));
    xhr.onabort = () => reject(new Error("upload aborted"));
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}
