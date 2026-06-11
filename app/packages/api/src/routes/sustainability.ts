import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { carbonForBuilding, recordMeterReading, seaiExport } from '../domain/sustainability.js';

export async function sustainabilityRoutes(app: FastifyInstance): Promise<void> {
  const readingSchema = z.object({ meterId: z.string().uuid(), value: z.number(), ts: z.string().optional() });
  app.post('/api/v1/sustainability/readings', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = readingSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    await withTenant(req.auth.tenantId, (c) => recordMeterReading(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ recorded: true });
  });

  app.get('/api/v1/sustainability/carbon', async (req, reply) => {
    const q = z.object({ buildingId: z.string().uuid(), from: z.string(), to: z.string() }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    const data = await withTenant(req.auth.tenantId, (c) => carbonForBuilding(c, req.auth.tenantId, q.data.buildingId, q.data.from, q.data.to));
    return reply.send(data);
  });

  app.get('/api/v1/sustainability/seai-export', async (req, reply) => {
    const q = z.object({ year: z.coerce.number() }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    const data = await withTenant(req.auth.tenantId, (c) => seaiExport(c, req.auth.tenantId, q.data.year));
    return reply.send(data);
  });
}
