import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { completeSoftTask, recordIpmObservation, recordWaste } from '../domain/softServices.js';

export async function softServiceRoutes(app: FastifyInstance): Promise<void> {
  const completeSchema = z.object({ taskId: z.string().uuid(), qrScan: z.boolean(), photoUri: z.string().nullish() });
  app.post('/api/v1/soft/completions', async (req, reply) => {
    const p = completeSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => completeSoftTask(c, req.auth.tenantId, { ...p.data, byUser: req.auth.userId }));
    return reply.code(201).send(result);
  });

  const ipmSchema = z.object({ trapId: z.string().uuid(), species: z.string().nullish(), count: z.number().int().optional(), materialRisk: z.string().nullish(), action: z.string().nullish() });
  app.post('/api/v1/ipm/observations', async (req, reply) => {
    const p = ipmSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => recordIpmObservation(c, req.auth.tenantId, p.data));
    return reply.code(201).send(result);
  });

  const wasteSchema = z.object({ buildingId: z.string().uuid().nullish(), stream: z.string(), weightKg: z.number().optional(), recycled: z.boolean().optional(), cost: z.number().optional() });
  app.post('/api/v1/waste', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = wasteSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => recordWaste(c, req.auth.tenantId, p.data));
    return reply.code(201).send(result);
  });
}
