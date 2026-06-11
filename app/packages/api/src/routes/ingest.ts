import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { evaluateReading, type Reading } from '../domain/collectionCare.js';
import { requireRole } from '../auth/rbac.js';

const readingSchema = z.object({
  sensorId: z.string().uuid(),
  zoneId: z.string().uuid(),
  metric: z.enum(['temp', 'rh', 'lux', 'uv', 'co2', 'voc', 'shock']),
  value: z.number(),
  unit: z.string().optional(),
  ts: z.string().datetime().optional(),
});

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  // Sensor adapters POST normalised readings here. Returns the evaluation —
  // including any excursion, named at-risk objects, and the work order raised.
  app.post('/api/v1/ingest/readings', {
    preHandler: requireRole('SystemAdmin', 'TenantAdmin', 'FacilitiesManager', 'ConservationOfficer'),
  }, async (req, reply) => {
    const parsed = readingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_reading', detail: parsed.error.flatten() });
    }
    const reading: Reading = parsed.data;
    const result = await withTenant(req.auth.tenantId, (client) =>
      evaluateReading(client, req.auth.tenantId, reading),
    );
    return reply.send(result);
  });
}
