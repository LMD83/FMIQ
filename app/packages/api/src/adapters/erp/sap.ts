import type { ProcurementGateway } from '../../domain/approvals.js';

/**
 * SAP procurement adapter (BTP REST / IDoc). Same ProcurementGateway port as Agresso;
 * the transport is injected. SAP returns a purchase-order document number.
 */
export interface SapPoster {
  (payload: { system: 'sap'; requisitionId: string; amountNet: number }): Promise<{ poNumber: string }>;
}

export function sapProcurementGateway(post: SapPoster): ProcurementGateway {
  return {
    async issuePurchaseOrder(req) {
      const res = await post({ system: 'sap', requisitionId: req.requisitionId, amountNet: req.amountNet });
      return { poReference: res.poNumber };
    },
  };
}
