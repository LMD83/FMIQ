import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { issueToWorkOrder, reserveForWorkOrder } from '../domain/inventory.js';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/parts', async (req, reply) => {
    const parts = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT p.id, p.code, p.name, p.critical, s.id AS stock_id, s.qty_on_hand, s.qty_reserved, s.min_qty
           FROM inv_part p LEFT JOIN inv_stock s ON s.part_id = p.id
          ORDER BY p.code LIMIT 500`,
      );
      return rows;
    });
    return reply.send({ parts });
  });

  const reserveSchema = z.object({ partId: z.string().uuid(), qty: z.number().positive(), workOrderId: z.string().uuid().optional() });
  app.post('/api/v1/parts/stock/:stockId/reserve', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { stockId } = req.params as { stockId: string };
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => reserveForWorkOrder(c, req.auth.tenantId, { stockId, ...parsed.data }));
    return reply.send(result);
  });

  const issueSchema = z.object({ partId: z.string().uuid(), qty: z.number().positive(), workOrderId: z.string().uuid().optional(), unitCost: z.number().optional() });
  app.post('/api/v1/parts/stock/:stockId/issue', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { stockId } = req.params as { stockId: string };
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => issueToWorkOrder(c, req.auth.tenantId, { stockId, ...parsed.data }));
    return reply.send(result);
  });
}
