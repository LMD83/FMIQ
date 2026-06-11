import { z } from 'zod';
import { canonicalMetric, type ParsedSensorReadings, type SensorAdapter } from './types.js';

/**
 * T&D adapter (TR7x series) — REST poll. JSON: { serial, readings:[{type,value,unit,time}] }.
 * Defensive parse; unknown metric channels dropped.
 */
const tanddSchema = z.object({
  serial: z.string(),
  readings: z.array(
    z.object({
      type: z.string(),
      value: z.number(),
      unit: z.string().optional(),
      time: z.string().optional(),
    }),
  ),
});

export const tanddAdapter: SensorAdapter = {
  vendor: 'tandd',
  parse(payload: unknown): ParsedSensorReadings {
    const body = tanddSchema.parse(payload);
    const readings = body.readings
      .map((r) => {
        const metric = canonicalMetric(r.type);
        return metric ? { metric, value: r.value, unit: r.unit, ts: r.time } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return { externalId: body.serial, readings };
  },
};
