import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { ApprovalError, issuePurchaseOrder, recordPoCallback } from '../domain/approvals.js';
import { resolveProcurementGateway } from '../adapters/resolve.js';

/**
 * ERP procurement boundary. Outbound issue-PO uses the configured ProcurementGateway
 * (Agresso/SAP adapter, or the null stub until a live transport + secret are wired).
 * Inbound po-callback lets the ERP write back PO/GRN/payment status. FMIQ never holds
 * invoice data. (HMAC verification on the callback is wired with the per-tenant secret.)
 */
export async function erpRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/requisitions/:id/issue-po', { preHandler: requireRole('TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      // Live gateway when ERP_TARGET + endpoint + secret are configured; else null (deferred).
      const po = await withTenant(req.auth.tenantId, (c) => issuePurchaseOrder(c, req.auth.tenantId, id, resolveProcurementGateway()));
      return reply.send({ poReference: po?.poReference ?? null, deferred: po === null });
    } catch (err) {
      if (err instanceof ApprovalError) {
        return reply.code(err.code === 'not_found' ? 404 : 409).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  const callbackSchema = z.object({
    requisitionId: z.string().uuid(),
    poReference: z.string().nullish(),
    grnNumber: z.string().nullish(),
    paymentStatus: z.string().nullish(),
  });
  app.post('/api/v1/erp/po-callback', async (req, reply) => {
    const parsed = callbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const ok = await withTenant(req.auth.tenantId, (c) => recordPoCallback(c, req.auth.tenantId, parsed.data));
    return reply.send({ recorded: ok });
  });
}
