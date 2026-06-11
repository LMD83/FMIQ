import { config } from '../config.js';
import { nullProcurementGateway, type ProcurementGateway } from '../domain/approvals.js';
import { nullTaxClearanceGateway, type TaxClearanceGateway } from '../domain/taxClearance.js';
import { agressoProcurementGateway } from './erp/agresso.js';
import { sapProcurementGateway } from './erp/sap.js';
import { revenueTaxClearanceGateway } from './revenue.js';
import { getText, signedPostJson } from './http.js';
import Anthropic from '@anthropic-ai/sdk';
import { ruleBasedTriage, type TriageGateway } from '../domain/ai.js';
import { claudeTriageGateway } from './ai/claude.js';

/**
 * Resolve live integration gateways from config. With endpoints + secrets set (Key Vault),
 * these call the real services; unset, they return the null/deferred gateway so dev and
 * tests never reach the network. This is the one place transports are wired.
 */

export function resolveProcurementGateway(): ProcurementGateway {
  const { target, endpoint, secret } = config.erp;
  if (!endpoint || !secret) return nullProcurementGateway;
  if (target === 'agresso') {
    return agressoProcurementGateway(async (p) => signedPostJson<{ poReference: string }>(endpoint, p, secret));
  }
  if (target === 'sap') {
    return sapProcurementGateway(async (p) => signedPostJson<{ poNumber: string }>(endpoint, p, secret));
  }
  return nullProcurementGateway;
}

export function resolveTaxClearanceGateway(): TaxClearanceGateway {
  const endpoint = config.revenueTcvEndpoint;
  if (!endpoint) return nullTaxClearanceGateway;
  // Revenue's verification service is keyed on the TCAN; the live transport returns XML.
  return revenueTaxClearanceGateway((tcan) => getText(`${endpoint}?tcan=${encodeURIComponent(tcan)}`));
}

/** AI triage: Claude (claude-opus-4-8) when ANTHROPIC_API_KEY is set, else rule-based. */
export function resolveTriageGateway(): TriageGateway {
  if (!process.env.ANTHROPIC_API_KEY) return ruleBasedTriage;
  return claudeTriageGateway(new Anthropic());
}
