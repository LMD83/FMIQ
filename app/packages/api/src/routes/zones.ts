import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';

export async function zoneRoutes(app: FastifyInstance): Promise<void> {
  // Live collection-care status per monitored zone: latest RH/temp + active band + RAG.
  app.get('/api/v1/zones', async (req, reply) => {
    const rows = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(`
        WITH latest AS (
          SELECT DISTINCT ON (zone_id, metric) zone_id, metric, value, ts
          FROM cc_reading ORDER BY zone_id, metric, ts DESC
        )
        SELECT z.id, z.name,
               sp.name AS space_name,
               s.code  AS standard,
               t.rh_min, t.rh_max, t.temp_min, t.temp_max,
               (SELECT value FROM latest l WHERE l.zone_id = z.id AND l.metric = 'rh')   AS rh,
               (SELECT value FROM latest l WHERE l.zone_id = z.id AND l.metric = 'temp') AS temp,
               EXISTS (SELECT 1 FROM cc_excursion e
                        WHERE e.cc_zone_id = z.id AND e.ended_at IS NULL) AS in_excursion
          FROM cc_zone z
          JOIN est_space sp ON sp.id = z.space_id
          LEFT JOIN cc_zone_target t ON t.cc_zone_id = z.id AND t.active = true
          LEFT JOIN cc_standard s ON s.id = t.cc_standard_id
         ORDER BY z.name`);
      return rows;
    });

    const zones = rows.map((z) => {
      let status: 'ok' | 'watch' | 'crit' = 'ok';
      if (z.in_excursion) status = 'crit';
      else if (z.rh != null && z.rh_max != null && (z.rh > z.rh_max - 2 || z.rh < (z.rh_min ?? 0) + 2)) status = 'watch';
      return { ...z, status };
    });
    return reply.send({ zones });
  });
}
