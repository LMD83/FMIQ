import { z } from 'zod';
import { canonicalMetric, type ParsedSensorReadings, type SensorAdapter } from './types.js';

/**
 * Conserv adapter.
 *
 * Conserv pushes environmental observations per device. We model the webhook
 * envelope defensively (accepting a couple of common field spellings) and map
 * its metric labels onto FMIQ's canonical codes. Unknown metrics are dropped
 * rather than rejected, so a firmware adding a new channel never breaks ingest.
 */
const conservSchema = z.object({
  device: z.object({ serial: z.string() }).optional(),
  device_id: z.string().optional(),
  observations: z.array(
    z.object({
      metric: z.string(),
      value: z.number(),
      unit: z.string().optional(),
      observed_at: z.string().optional(),
      recorded_at: z.string().optional(),
    }),
  ),
});

export const conservAdapter: SensorAdapter = {
  vendor: 'conserv',
  parse(payload: unknown): ParsedSensorReadings {
    const body = conservSchema.parse(payload);
    const externalId = body.device?.serial ?? body.device_id;
    if (!externalId) throw new Error('conserv payload missing device serial/id');

    const readings = body.observations
      .map((o) => {
        const metric = canonicalMetric(o.metric);
        if (!metric) return null;
        return {
          metric,
          value: o.value,
          unit: o.unit,
          ts: o.observed_at ?? o.recorded_at,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return { externalId, readings };
  },
};
