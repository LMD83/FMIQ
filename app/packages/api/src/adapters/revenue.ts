import type { TaxClearanceGateway, TaxClearanceStatus } from '../domain/taxClearance.js';

/**
 * Revenue eTax Clearance Verification adapter (S.I. 463/2012). The live service is a
 * SOAP/XML web service keyed on a TCAN; here we implement the *parse + map* (real and
 * tested) and inject the network call as a `fetcher` so it's testable offline and the
 * transport can be swapped without touching the mapping.
 */

/** Map a Revenue verification response (XML/text) onto FMIQ's status. */
export function parseRevenueResponse(xml: string): TaxClearanceStatus {
  const m =
    /<(?:\w+:)?(?:Result|Status|TaxClearanceStatus)>([^<]+)<\/(?:\w+:)?(?:Result|Status|TaxClearanceStatus)>/i.exec(xml);
  const v = (m?.[1] ?? '').trim().toLowerCase();
  if (!v) return 'unknown';
  if (v.includes('valid') || v.includes('cleared') || v === 'active') return 'valid';
  if (v.includes('expired')) return 'expired';
  if (v.includes('revoked') || v.includes('rescinded')) return 'revoked';
  if (v.includes('suspended')) return 'suspended';
  return 'unknown';
}

export type RevenueFetcher = (tcan: string) => Promise<string>;

/** Build a TaxClearanceGateway from a transport that returns the raw Revenue response. */
export function revenueTaxClearanceGateway(fetcher: RevenueFetcher): TaxClearanceGateway {
  return {
    async verify(tcan: string): Promise<TaxClearanceStatus> {
      try {
        return parseRevenueResponse(await fetcher(tcan));
      } catch {
        return 'unknown'; // never block on a transport error; the daily re-check retries
      }
    },
  };
}
