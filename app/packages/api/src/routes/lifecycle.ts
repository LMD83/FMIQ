import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { addBacklogItem, LifecycleError, replacementForecast, startCapitalBid, unfundedBacklog } from '../domain/lifecycle.js';

export async function lifecycleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/lifecycle/forecast', async (req, reply) => {
    const q = z.object({ horizonYears: z.coerce.number().optional() }).safeParse(req.query);
    const data = await withTenant(req.auth.tenantId, (c) => replacementForecast(c, req.auth.tenantId, q.success ? q.data.horizonYears ?? 5 : 5));
    return reply.send(data);
  });

  app.get('/api/v1/lifecycle/backlog', async (req, reply) => {
    const summary = await withTenant(req.auth.tenantId, (c) => unfundedBacklog(c, req.auth.tenantId));
    return reply.send(summary);
  });

  const backlogSchema = z.object({ assetId: z.string().uuid().nullish(), description: z.string(), costEstimate: z.number().optional(), riskScore: z.number().int().optional(), collectionsRisk: z.boolean().optional() });
  app.post('/api/v1/lifecycle/backlog', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = backlogSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const item = await withTenant(req.auth.tenantId, (c) => addBacklogItem(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ item });
  });

  app.post('/api/v1/lifecycle/assets/:id/capital-bid', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await withTenant(req.auth.tenantId, (c) => startCapitalBid(c, req.auth.tenantId, id));
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof LifecycleError) {
        return reply.code(err.code === 'not_found' ? 404 : 409).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
