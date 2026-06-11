import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { evaluateReading, type EvaluationResult } from '../domain/collectionCare.js';
import { conservAdapter } from '../adapters/conserv.js';
import { hanwellAdapter } from '../adapters/hanwell.js';
import { tanddAdapter } from '../adapters/tandd.js';
import type { SensorAdapter } from '../adapters/types.js';

const adapters: Record<string, SensorAdapter> = {
  conserv: conservAdapter,
  hanwell: hanwellAdapter,
  tandd: tanddAdapter,
};

export async function adapterRoutes(app: FastifyInstance): Promise<void> {
  // Vendor webhooks land here. The adapter normalises the payload; we resolve
  // the vendor's device id to an FMIQ sensor/zone, then drive the SAME engine.
  app.post('/api/v1/adapters/:vendor/webhook', async (req, reply) => {
    const { vendor } = req.params as { vendor: string };
    const adapter = adapters[vendor];
    if (!adapter) return reply.code(404).send({ error: 'unknown_adapter', vendor });

    let parsed;
    try {
      parsed = adapter.parse(req.body);
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_payload', detail: (e as Error).message });
    }

    const results = await withTenant(req.auth.tenantId, async (client) => {
      const sensor = await client.query<{ id: string; cc_zone_id: string }>(
        `SELECT id, cc_zone_id FROM cc_sensor WHERE vendor = $1 AND external_id = $2`,
        [adapter.vendor, parsed.externalId],
      );
      if (sensor.rowCount === 0) return { unknownSensor: parsed.externalId, evaluations: [] as EvaluationResult[] };

      const { id: sensorId, cc_zone_id: zoneId } = sensor.rows[0];
      await client.query(`UPDATE cc_sensor SET last_seen_at = now(), status = 'online' WHERE id = $1`, [sensorId]);

      const evaluations: EvaluationResult[] = [];
      for (const r of parsed.readings) {
        evaluations.push(
          await evaluateReading(client, req.auth.tenantId, {
            sensorId, zoneId, metric: r.metric, value: r.value, unit: r.unit, ts: r.ts,
          }),
        );
      }
      return { unknownSensor: null, evaluations };
    });

    const breaches = results.evaluations.filter((e) => e.breach);
    return reply.send({
      vendor: adapter.vendor,
      externalId: parsed.externalId,
      ingested: results.evaluations.length,
      unknownSensor: results.unknownSensor,
      breaches,
    });
  });
}
