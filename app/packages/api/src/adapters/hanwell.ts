import { canonicalMetric, type NormalisedReading, type ParsedSensorReadings, type SensorAdapter } from './types.js';

/**
 * Hanwell adapter — CSV/agent push (the UK heritage datalogger standard).
 * Long-format CSV with a header row: serial,metric,value,unit,timestamp (one device
 * per payload). Unknown metrics are dropped, not rejected (mirrors conserv.ts).
 */
export const hanwellAdapter: SensorAdapter = {
  vendor: 'hanwell',
  parse(payload: unknown): ParsedSensorReadings {
    if (typeof payload !== 'string') throw new Error('hanwell payload must be CSV text');
    const lines = payload.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error('hanwell CSV has no data rows');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const iSerial = col('serial');
    const iMetric = col('metric');
    const iValue = col('value');
    if (iSerial < 0 || iMetric < 0 || iValue < 0) throw new Error('hanwell CSV missing serial/metric/value columns');
    const iUnit = col('unit');
    const iTs = col('timestamp');

    let externalId = '';
    const readings: NormalisedReading[] = [];
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      externalId = externalId || cells[iSerial]?.trim();
      const metric = canonicalMetric(cells[iMetric] ?? '');
      const value = Number(cells[iValue]);
      if (!metric || Number.isNaN(value)) continue;
      readings.push({ metric, value, unit: iUnit >= 0 ? cells[iUnit]?.trim() : undefined, ts: iTs >= 0 ? cells[iTs]?.trim() : undefined });
    }
    if (!externalId) throw new Error('hanwell CSV missing serial');
    return { externalId, readings };
  },
};
