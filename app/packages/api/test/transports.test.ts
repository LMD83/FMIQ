// Live transport wiring — HMAC signing/verify + gateway resolution from config.
import { describe, expect, it } from 'vitest';
import { hmacSignature, verifyHmac } from '../src/adapters/http.js';
import { resolveProcurementGateway, resolveTaxClearanceGateway } from '../src/adapters/resolve.js';

describe('HMAC transport', () => {
  it('signs deterministically and verifies', () => {
    const sig = hmacSignature('{"a":1}', 'secret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyHmac('{"a":1}', sig, 'secret')).toBe(true);
    expect(verifyHmac('{"a":1}', sig, 'wrong')).toBe(false);
    expect(verifyHmac('{"a":2}', sig, 'secret')).toBe(false);
  });
});

describe('gateway resolution (defaults to null without config)', () => {
  it('procurement gateway is the null stub when ERP is unconfigured', async () => {
    // No ERP_* env in tests → deferred (returns null PO).
    const po = await resolveProcurementGateway().issuePurchaseOrder({ requisitionId: 'x', amountNet: 1 });
    expect(po).toBeNull();
  });

  it('tax-clearance gateway is the null stub when Revenue is unconfigured', async () => {
    expect(await resolveTaxClearanceGateway().verify('TCAN1')).toBe('unknown');
  });
});
