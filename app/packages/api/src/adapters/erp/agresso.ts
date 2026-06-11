import type { ProcurementGateway } from '../../domain/approvals.js';

/**
 * Agresso (Unit4) procurement adapter. FMIQ posts an approved+committed requisition;
 * Agresso issues the PO and returns its reference. The transport (HMAC webhook out) is
 * injected so the mapping is testable offline and secrets stay in Key Vault.
 */
export interface AgressoPoster {
  (payload: { system: 'agresso'; requisitionId: string; amountNet: number }): Promise<{ poReference: string }>;
}

export function agressoProcurementGateway(post: AgressoPoster): ProcurementGateway {
  return {
    async issuePurchaseOrder(req) {
      const res = await post({ system: 'agresso', requisitionId: req.requisitionId, amountNet: req.amountNet });
      return { poReference: res.poReference };
    },
  };
}
