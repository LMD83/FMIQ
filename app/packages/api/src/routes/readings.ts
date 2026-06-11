import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';

const querySchema = z.object({
  metric: z.enum(['temp', 'rh', 'lux', 'uv', 'co2', 'voc', 'shock']).default('rh'),
  hours: z.coerce.number().int().min(1).max(8760).default(24),
});

export async function readingRoutes(app: FastifyInstance): Promise<void> {
  // Trend series for one zone+metric — backs the collection-care chart.
  app.get('/api/v1/zones/:zoneId/readings', async (req, reply) => {
    const { zoneId } = req.params as { zoneId: string };
    const q = querySchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_query', detail: q.error.flatten() });

    const data = await withTenant(req.auth.tenantId, async (client) => {
      const target = await client.query(
        `SELECT rh_min, rh_max, temp_min, temp_max FROM cc_zone_target
          WHERE cc_zone_id = $1 AND active = true ORDER BY id LIMIT 1`,
        [zoneId],
      );
      const series = await client.query(
        `SELECT ts, value FROM cc_reading
          WHERE zone_id = $1 AND metric = $2 AND ts > now() - ($3 || ' hours')::interval
          ORDER BY ts ASC`,
        [zoneId, q.data.metric, String(q.data.hours)],
      );
      return { target: target.rows[0] ?? null, series: series.rows };
    });

    return reply.send({ zoneId, metric: q.data.metric, hours: q.data.hours, ...data });
  });
}
