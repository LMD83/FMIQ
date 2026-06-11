import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { parseMetEireannForecast } from '../adapters/metEireann.js';
import { assessPreconditioning, loadZoneBand } from '../domain/preconditioning.js';

export async function preconditioningRoutes(app: FastifyInstance): Promise<void> {
  // Given a zone + a Met Éireann forecast payload, return pre-conditioning actions.
  const schema = z.object({ zoneId: z.string().uuid(), forecast: z.unknown() });
  app.post('/api/v1/preconditioning/assess', async (req, reply) => {
    const p = schema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    let forecast;
    try {
      forecast = parseMetEireannForecast(p.data.forecast);
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_forecast', detail: (e as Error).message });
    }
    const result = await withTenant(req.auth.tenantId, async (c) => {
      const band = await loadZoneBand(c, p.data.zoneId);
      if (!band) return { band: null, actions: [] };
      return { band, actions: assessPreconditioning(band, forecast) };
    });
    if (!result.band) return reply.code(404).send({ error: 'no_active_target' });
    return reply.send({ actions: result.actions });
  });
}
