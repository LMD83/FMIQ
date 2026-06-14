/**
 * VerifIQ — browser upload-helper tests (docs/42 §5.2, Sprint 2).
 * Pure logic only: the SHA-256 digest and the byte formatter.
 */

import { describe, it, expect } from "vitest";
import { sha256Hex, sha256OfBlob, formatBytes, UPLOAD_DISCIPLINES } from "../src/storage/upload-client";

describe("upload-client helpers", () => {
  it("sha256Hex matches the known vector for 'abc'", async () => {
    const data = new TextEncoder().encode("abc");
    const hex = await sha256Hex(data);
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("sha256OfBlob hashes file contents", async () => {
    const blob = new Blob([new TextEncoder().encode("abc")]);
    const hex = await sha256OfBlob(blob);
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("formatBytes renders human sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("exposes the discipline vocabulary", () => {
    expect(UPLOAD_DISCIPLINES).toContain("architectural");
    expect(UPLOAD_DISCIPLINES).toContain("unclassified");
  });
});
