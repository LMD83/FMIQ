import { z } from 'zod';

/**
 * Met Éireann forecast adapter (CC BY 4.0 open data). Parses the per-point forecast to a
 * normalised series; domain/preconditioning.ts uses it to act BEFORE an excursion.
 */
export interface ForecastPoint {
  ts: string;
  tempC?: number;
  rh?: number;
}

const schema = z.object({
  forecast: z.array(
    z.object({
      dateTime: z.string(),
      temperature: z.number().optional(),
      humidity: z.number().optional(),
    }),
  ),
});

export function parseMetEireannForecast(payload: unknown): ForecastPoint[] {
  const b = schema.parse(payload);
  return b.forecast.map((p) => ({ ts: p.dateTime, tempC: p.temperature, rh: p.humidity }));
}
