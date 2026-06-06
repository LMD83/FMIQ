/**
 * VerifIQ — Cloudflare R2 storage adapter.
 *
 * R2 is S3-compatible, so this uses @aws-sdk/client-s3 pointed at the R2
 * endpoint (`https://<account>.r2.cloudflarestorage.com`, region "auto"). It
 * provides signed upload/download URLs for direct browser↔R2 transfer (tus.io
 * compatible), range reads for streaming PDFs, and multipart helpers for files
 * over 5 MB.
 *
 * Spec references: docs/27 (R2 hybrid, zero-egress, no blob ceiling);
 * verifiq-prompts/20_platform_architecture.md § 1; docs/28 § D3.
 * Version: 0.3.0-phase1
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type ByteRange,
  type FileMeta,
  type ObjectHead,
  type StorageProvider,
  type UploadTarget,
  buildObjectKey,
  computeSha256,
} from "./types.js";

const ONE_HOUR = 3600;
/** S3 minimum part size for multipart uploads. */
export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class R2Provider implements StorageProvider {
  readonly name = "r2" as const;
  private client: S3Client;
  private bucket: string;

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async getUploadUrl(meta: FileMeta): Promise<UploadTarget> {
    const key = buildObjectKey(meta);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: meta.content_type,
      // R2 stores the client-computed hash so completion can be checked.
      Metadata: { sha256: meta.sha256 },
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: ONE_HOUR });
    return {
      url,
      key,
      method: "PUT",
      headers: meta.content_type ? { "Content-Type": meta.content_type } : undefined,
      expires_in: ONE_HOUR,
    };
  }

  async getDownloadUrl(key: string, expiresInSeconds = ONE_HOUR): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getObject(key: string, range?: ByteRange): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    });
    const resp = await this.client.send(command);
    const body = resp.Body as { transformToByteArray(): Promise<Uint8Array> } | undefined;
    if (!body) return new Uint8Array();
    return body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const resp = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size_bytes: resp.ContentLength ?? 0,
        etag: resp.ETag,
        content_type: resp.ContentType,
      };
    } catch {
      return null;
    }
  }

  // ── Multipart upload (files > 5 MB; file 20 § 1) ──────────────────────────

  /** Begin a multipart upload; returns the uploadId. */
  async createMultipartUpload(meta: FileMeta): Promise<{ key: string; uploadId: string }> {
    const key = buildObjectKey(meta);
    const resp = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: meta.content_type,
        Metadata: { sha256: meta.sha256 },
      }),
    );
    if (!resp.UploadId) throw new Error("R2 did not return an UploadId");
    return { key, uploadId: resp.UploadId };
  }

  /** Signed URL for a single part (1-indexed). */
  async getUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds = ONE_HOUR,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /** Finalise a multipart upload from the per-part ETags. */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  /** Abort a multipart upload, releasing any parts already stored (cleanup on
   * failure / per-file re-upload; file 20 § 1 failure modes). */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  // ── Integrity verification (file 20 § 1: "verified server-side at completion") ──

  /**
   * Verify a stored object against the SHA-256 the client computed before
   * upload. Downloads the object and re-hashes it; returns true on match. A
   * mismatch should trigger a per-file re-upload (file 20 § 1). Note: this reads
   * the whole object, so call it at completion, not on the hot path.
   */
  async verifyUpload(key: string, expectedSha256: string): Promise<boolean> {
    const bytes = await this.getObject(key);
    const actual = await computeSha256(bytes);
    return actual === expectedSha256;
  }
}

/** Build an R2Provider from environment variables, or null if unconfigured. */
export function r2FromEnv(env: Record<string, string | undefined>): R2Provider | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return null;
  }
  return new R2Provider({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET_NAME,
  });
}
