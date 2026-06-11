import type { PoolClient } from 'pg';
import { emitEvent } from './outbox.js';
import { nextRef } from './workOrders.js';

/**
 * The hero logic. Given a new sensor reading, FMIQ:
 *   1. records it,
 *   2. evaluates it against the zone's ACTIVE conservation standard
 *      (absolute band AND rate-of-change),
 *   3. on breach: opens an excursion, NAMES the at-risk objects (from the linked
 *      CMS), raises a work order with conservation notes, and returns the alerts
 *      that should be routed (Conservation Officer + FM).
 *
 * Everything runs inside a tenant-scoped transaction, so RLS guarantees isolation.
 */

export interface Reading {
  sensorId: string;
  zoneId: string;
  metric: 'temp' | 'rh' | 'lux' | 'uv' | 'co2' | 'voc' | 'shock';
  value: number;
  unit?: string;
  ts?: string;
}

type Severity = 'watch' | 'breach' | 'critical';

export interface AtRiskObject {
  cmsObjectId: string;
  objectName: string;
  material: string | null;
  sensitivity: 'low' | 'med' | 'high';
}

export interface EvaluationResult {
  recorded: true;
  breach: boolean;
  severity?: Severity;
  kind?: 'absolute' | 'rate_of_change';
  zoneName?: string;
  excursionId?: string;
  workOrderRef?: string;
  atRiskObjects: AtRiskObject[];
  alerts: { audience: 'ConservationOfficer' | 'FacilitiesManager'; message: string }[];
}

interface ZoneTarget {
  id: string;
  zone_name: string;
  rh_min: number | null;
  rh_max: number | null;
  rh_rate_max_per_24h: number | null;
  temp_min: number | null;
  temp_max: number | null;
  lux_max: number | null;
  uv_max_uw_per_lm: number | null;
  co2_max_ppm: number | null;
}

const severityRank: Record<Severity, number> = { watch: 1, breach: 2, critical: 3 };
const worst = (a: Severity | undefined, b: Severity | undefined): Severity | undefined => {
  if (!a) return b;
  if (!b) return a;
  return severityRank[a] >= severityRank[b] ? a : b;
};

/** Two-sided band severity (RH, temp): breach outside [min,max]; critical beyond ±margin. */
function bandSeverity(value: number, minRaw: number | null, maxRaw: number | null, crit: number, watch: number): Severity | undefined {
  if (minRaw == null || maxRaw == null) return undefined;
  // pg returns `numeric` columns as strings — coerce, or `max + crit` would concatenate.
  const v = Number(value), min = Number(minRaw), max = Number(maxRaw);
  if (v > max + crit || v < min - crit) return 'critical';
  if (v > max || v < min) return 'breach';
  if (v > max - watch || v < min + watch) return 'watch';
  return undefined;
}

/** One-sided ceiling severity (lux, uv, co2): breach above max; critical >25% over. */
function ceilingSeverity(value: number, maxRaw: number | null): Severity | undefined {
  if (maxRaw == null) return undefined;
  const v = Number(value), max = Number(maxRaw);
  if (v > max * 1.25) return 'critical';
  if (v > max) return 'breach';
  if (v > max * 0.9) return 'watch';
  return undefined;
}

export async function evaluateReading(
  client: PoolClient,
  tenantId: string,
  reading: Reading,
): Promise<EvaluationResult> {
  const ts = reading.ts ?? new Date().toISOString();

  // 1. Record the reading
  await client.query(
    `INSERT INTO cc_reading (tenant_id, sensor_id, zone_id, metric, value, unit, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [tenantId, reading.sensorId, reading.zoneId, reading.metric, reading.value, reading.unit ?? null, ts],
  );

  const base: EvaluationResult = { recorded: true, breach: false, atRiskObjects: [], alerts: [] };

  // Only RH/temp drive conservation excursions in this slice
  const target = await loadActiveTarget(client, reading.zoneId);
  if (!target) return base;

  let severity: Severity | undefined;
  let kind: 'absolute' | 'rate_of_change' | undefined;

  // 2a. Absolute checks — metric-specific. RH/temp are two-sided bands; lux/uv/co2
  //     are ceilings (cumulative light/exposure/air-quality limits).
  let abs: Severity | undefined;
  if (reading.metric === 'rh') abs = bandSeverity(reading.value, target.rh_min, target.rh_max, 5, 2);
  else if (reading.metric === 'temp') abs = bandSeverity(reading.value, target.temp_min, target.temp_max, 2, 1);
  else if (reading.metric === 'lux') abs = ceilingSeverity(reading.value, target.lux_max);
  else if (reading.metric === 'uv') abs = ceilingSeverity(reading.value, target.uv_max_uw_per_lm);
  else if (reading.metric === 'co2') abs = ceilingSeverity(reading.value, target.co2_max_ppm);
  if (abs) {
    severity = abs;
    kind = 'absolute';
  }

  // 2b. Rate-of-change check (RH) — the parameter that actually damages objects.
  if (reading.metric === 'rh' && target.rh_rate_max_per_24h != null) {
    const prev = await previousReading(client, reading.zoneId, reading.metric, ts);
    if (prev) {
      const hours = (new Date(ts).getTime() - new Date(prev.ts).getTime()) / 3_600_000;
      if (hours > 0) {
        const projected24h = Math.abs((reading.value - prev.value) / hours) * 24;
        const rate: Severity | undefined =
          projected24h > target.rh_rate_max_per_24h * 2 ? 'critical'
          : projected24h > target.rh_rate_max_per_24h ? 'breach'
          : undefined;
        if (rate) {
          if (!severity || severityRank[rate] >= severityRank[severity]) kind = 'rate_of_change';
          severity = worst(severity, rate);
        }
      }
    }
  }

  if (!severity || severity === 'watch') {
    return { ...base, severity, kind, zoneName: target.zone_name };
  }

  // 3. Breach. De-duplicate: reuse an open excursion for this zone+metric if present.
  const objects = await atRiskObjects(client, reading.zoneId);
  const existing = await openExcursion(client, reading.zoneId, reading.metric);
  if (existing) {
    return {
      recorded: true, breach: true, severity, kind,
      zoneName: target.zone_name, excursionId: existing.id,
      workOrderRef: existing.work_order_ref ?? undefined,
      atRiskObjects: objects,
      alerts: [],
    };
  }

  const excursionId = await createExcursion(client, tenantId, target, reading, severity, kind!);
  const workOrderRef = await raiseWorkOrder(client, tenantId, target, reading, severity, objects, excursionId);

  const highCount = objects.filter((o) => o.sensitivity === 'high').length;

  // Emit the domain event atomically with the excursion + work order (same tx).
  // Idempotency-keyed on the excursion so a re-run never double-publishes.
  await emitEvent(client, {
    tenantId,
    type: 'fmiq.excursion.opened',
    subject: excursionId,
    idempotencyKey: `excursion.opened:${excursionId}`,
    data: {
      zoneId: reading.zoneId,
      zoneName: target.zone_name,
      metric: reading.metric,
      severity,
      kind,
      value: reading.value,
      workOrderRef,
      atRiskObjects: objects.length,
      highSensitivityObjects: highCount,
    },
  });

  return {
    recorded: true, breach: true, severity, kind,
    zoneName: target.zone_name, excursionId, workOrderRef,
    atRiskObjects: objects,
    alerts: [
      {
        audience: 'ConservationOfficer',
        message: `${severity.toUpperCase()} ${reading.metric.toUpperCase()} ${kind === 'rate_of_change' ? 'rate-of-change' : 'band'} excursion in ${target.zone_name}. ${objects.length} objects in zone, ${highCount} high-sensitivity.`,
      },
      {
        audience: 'FacilitiesManager',
        message: `Work order ${workOrderRef} auto-raised for ${target.zone_name} (${reading.metric} ${reading.value}). Conservation notes attached.`,
      },
    ],
  };
}

async function loadActiveTarget(client: PoolClient, zoneId: string): Promise<ZoneTarget | null> {
  const { rows } = await client.query<ZoneTarget>(
    `SELECT t.id, z.name AS zone_name, t.rh_min, t.rh_max, t.rh_rate_max_per_24h,
            t.temp_min, t.temp_max, t.lux_max, t.uv_max_uw_per_lm, t.co2_max_ppm
       FROM cc_zone_target t JOIN cc_zone z ON z.id = t.cc_zone_id
      WHERE t.cc_zone_id = $1 AND t.active = true
      ORDER BY t.id LIMIT 1`,
    [zoneId],
  );
  return rows[0] ?? null;
}

async function previousReading(
  client: PoolClient, zoneId: string, metric: string, beforeTs: string,
): Promise<{ value: number; ts: string } | null> {
  const { rows } = await client.query<{ value: number; ts: string }>(
    `SELECT value, ts FROM cc_reading
      WHERE zone_id = $1 AND metric = $2 AND ts < $3
      ORDER BY ts DESC LIMIT 1`,
    [zoneId, metric, beforeTs],
  );
  return rows[0] ?? null;
}

async function atRiskObjects(client: PoolClient, zoneId: string): Promise<AtRiskObject[]> {
  const { rows } = await client.query(
    `SELECT cms_object_id, object_name, material, sensitivity
       FROM cc_object_link WHERE cc_zone_id = $1
      ORDER BY CASE sensitivity WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END`,
    [zoneId],
  );
  return rows.map((r) => ({
    cmsObjectId: r.cms_object_id, objectName: r.object_name, material: r.material, sensitivity: r.sensitivity,
  }));
}

async function openExcursion(
  client: PoolClient, zoneId: string, metric: string,
): Promise<{ id: string; work_order_ref: string | null } | null> {
  const { rows } = await client.query(
    `SELECT e.id, w.ref AS work_order_ref
       FROM cc_excursion e LEFT JOIN wo_work_order w ON w.id = e.work_order_id
      WHERE e.cc_zone_id = $1 AND e.metric = $2 AND e.ended_at IS NULL
      ORDER BY e.started_at DESC LIMIT 1`,
    [zoneId, metric],
  );
  return rows[0] ?? null;
}

async function createExcursion(
  client: PoolClient, tenantId: string, target: ZoneTarget, reading: Reading,
  severity: Severity, kind: 'absolute' | 'rate_of_change',
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO cc_excursion
       (tenant_id, cc_zone_id, cc_zone_target_id, metric, kind, severity, peak_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, reading.zoneId, target.id, reading.metric, kind, severity, reading.value],
  );
  return rows[0].id;
}

async function raiseWorkOrder(
  client: PoolClient, tenantId: string, target: ZoneTarget, reading: Reading,
  severity: Severity, objects: AtRiskObject[], excursionId: string,
): Promise<string> {
  const ref = await nextRef(client, tenantId);
  const priority = severity === 'critical' ? 'critical' : 'high';
  const slaHours = severity === 'critical' ? 2 : 24;
  const slaDue = new Date(Date.now() + slaHours * 3_600_000).toISOString();
  const high = objects.filter((o) => o.sensitivity === 'high');
  const notes =
    `Auto-raised from ${reading.metric.toUpperCase()} excursion (${severity}). ` +
    `Active standard band breached in ${target.zone_name}. ` +
    `${objects.length} object(s) in zone; ${high.length} high-sensitivity: ` +
    `${high.map((o) => `${o.objectName} [${o.material ?? 'n/a'}]`).join('; ') || 'none'}. ` +
    `Conservation guidance: stabilise RH, check humidification/AHU, avoid rapid correction.`;

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO wo_work_order
       (tenant_id, ref, space_id, source, cc_excursion_id, priority, sla_due, title, conservation_notes)
     SELECT $1,$2, z.space_id, 'excursion', $3, $4, $5, $6, $7
       FROM cc_zone z WHERE z.id = $8 RETURNING id`,
    [tenantId, ref, excursionId, priority, slaDue,
     `${reading.metric.toUpperCase()} excursion — ${target.zone_name}`, notes, reading.zoneId],
  );
  await client.query(`UPDATE cc_excursion SET work_order_id = $1 WHERE id = $2`, [rows[0].id, excursionId]);
  return ref;
}
