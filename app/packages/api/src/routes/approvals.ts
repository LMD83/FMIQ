import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { ApprovalError, createRequisition, decide } from '../domain/approvals.js';

export async function approvalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/requisitions', async (req, reply) => {
    const requisitions = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT id, amount_net, category, status, current_step, cost_centre, created_at FROM apr_requisition ORDER BY created_at DESC LIMIT 200`,
      );
      return rows;
    });
    return reply.send({ requisitions });
  });

  app.get('/api/v1/commitments', async (req, reply) => {
    const commitments = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT id, requisition_id, cost_centre, project_id, amount_net, status, created_at FROM apr_commitment ORDER BY created_at DESC LIMIT 200`,
      );
      return rows;
    });
    return reply.send({ commitments });
  });

  const createSchema = z.object({
    amountNet: z.number().positive(),
    category: z.enum(['capital', 'revenue', 'emergency']).optional(),
    costCentre: z.string().nullish(),
    projectId: z.string().uuid().nullish(),
    workOrderId: z.string().uuid().nullish(),
    supplierId: z.string().uuid().nullish(),
  });
  app.post('/api/v1/requisitions', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const requisition = await withTenant(req.auth.tenantId, (c) => createRequisition(c, req.auth.tenantId, { ...parsed.data, createdBy: req.auth.userId }));
      return reply.code(201).send({ requisition });
    } catch (err) {
      if (err instanceof ApprovalError) return reply.code(409).send({ error: err.code, message: err.message });
      throw err;
    }
  });

  const decisionSchema = z.object({ decision: z.enum(['approved', 'rejected']), comment: z.string().nullish() });
  app.post('/api/v1/requisitions/:id/decision', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        decide(c, req.auth.tenantId, { requisitionId: id, approverId: req.auth.userId, approverRoles: req.auth.roles, ...parsed.data }),
      );
      return reply.send({ requisition: result });
    } catch (err) {
      if (err instanceof ApprovalError) {
        const status = err.code === 'segregation_of_duties' || err.code === 'wrong_role' ? 403 : err.code === 'not_found' ? 404 : 409;
        return reply.code(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
