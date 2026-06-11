import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { convertRequest, createRequest } from '../domain/requests.js';
import { contractorScorecard, setSlaPolicy } from '../domain/sla.js';

export async function helpdeskRoutes(app: FastifyInstance): Promise<void> {
  // Self-service intake — open to any authenticated user (the demand channel).
  const reqSchema = z.object({
    description: z.string().min(1),
    channel: z.enum(['web', 'email', 'qr', 'phone', 'mobile']).optional(),
    requesterName: z.string().nullish(),
    requesterEmail: z.string().nullish(),
    spaceId: z.string().uuid().nullish(),
    assetId: z.string().uuid().nullish(),
  });
  app.post('/api/v1/requests', async (req, reply) => {
    const p = reqSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const request = await withTenant(req.auth.tenantId, (c) => createRequest(c, req.auth.tenantId, { ...p.data, requesterId: req.auth.userId }));
    return reply.code(201).send({ request });
  });

  app.get('/api/v1/requests', async (req, reply) => {
    const requests = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT id, channel, category, description, priority, status, sla_due, work_order_id, created_at
           FROM req_request ORDER BY created_at DESC LIMIT 200`,
      );
      return rows;
    });
    return reply.send({ requests });
  });

  app.post('/api/v1/requests/:id/convert', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await withTenant(req.auth.tenantId, (c) => convertRequest(c, req.auth.tenantId, id));
    return reply.code(201).send(result);
  });

  // SLA policy configuration.
  const slaSchema = z.object({ name: z.string(), priority: z.enum(['routine', 'high', 'critical']), responseMins: z.number().int().positive(), fixMins: z.number().int().positive() });
  app.post('/api/v1/sla/policies', { preHandler: requireRole('TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = slaSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    await withTenant(req.auth.tenantId, (c) => setSlaPolicy(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ ok: true });
  });

  // Contractor performance scorecard.
  app.get('/api/v1/contractors/:id/scorecard', async (req, reply) => {
    const { id } = req.params as { id: string };
    const scorecard = await withTenant(req.auth.tenantId, (c) => contractorScorecard(c, req.auth.tenantId, id));
    return reply.send({ scorecard });
  });
}
