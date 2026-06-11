import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Production HTTP transport helpers for outbound integrations (ERP, webhooks). Built on
 * Node's global fetch with timeouts and HMAC-SHA256 signing. Secrets come from config
 * (Key Vault in production) — never hard-coded. Inbound webhooks verify the same way.
 */

export function hmacSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Constant-time verify of an inbound webhook signature. */
export function verifyHmac(body: string, signature: string, secret: string): boolean {
  const expected = hmacSignature(body, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function signedPostJson<T = unknown>(url: string, payload: unknown, secret: string, opts: HttpOptions = {}): Promise<T> {
  const body = JSON.stringify(payload);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fmiq-signature': hmacSignature(body, secret), ...opts.headers },
    body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return (await res.json()) as T;
}

export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await fetch(url, { headers: opts.headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export async function getJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const res = await fetch(url, { headers: opts.headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}
