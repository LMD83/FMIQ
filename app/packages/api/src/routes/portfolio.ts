import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';

/** Read endpoints that back the Dashboard, Estate, Compliance and Projects tabs. */
export async function portfolioRoutes(app: FastifyInstance): Promise<void> {
  // Estate dashboard KPIs + per-site compliance for charts.
  app.get('/api/v1/summary', async (req, reply) => {
    const data = await withTenant(req.auth.tenantId, async (client) => {
      const buildings = await client.query(`SELECT count(*)::int n FROM est_building`);
      const sites = await client.query(`SELECT count(*)::int n FROM est_site`);
      const zones = await client.query(`SELECT count(*)::int n FROM cc_zone`);
      const excursions = await client.query(`SELECT count(*)::int n FROM cc_excursion WHERE ended_at IS NULL`);
      const openWo = await client.query(`SELECT count(*)::int n FROM wo_work_order WHERE status <> 'closed'`);
      const woToday = await client.query(`SELECT count(*)::int n FROM wo_work_order WHERE opened_at > now() - interval '24 hours'`);
      const cmpRag = await client.query(
        `SELECT status_rag, count(*)::int n FROM cmp_obligation GROUP BY status_rag`,
      );
      const woByStatus = await client.query(
        `SELECT status, count(*)::int n FROM wo_work_order GROUP BY status`,
      );
      const zoneCount = zones.rows[0].n as number;
      const exc = excursions.rows[0].n as number;
      const compliantPct = zoneCount ? Math.round(((zoneCount - exc) / zoneCount) * 100) : 100;
      return {
        buildings: buildings.rows[0].n, sites: sites.rows[0].n,
        zones: zoneCount, excursions: exc, compliantPct,
        openWorkOrders: openWo.rows[0].n, workOrdersToday: woToday.rows[0].n,
        complianceRag: Object.fromEntries(cmpRag.rows.map((r) => [r.status_rag, r.n])),
        workOrdersByStatus: Object.fromEntries(woByStatus.rows.map((r) => [r.status, r.n])),
      };
    });
    return reply.send(data);
  });

  // Portfolio: sites with a rolled-up conservation status.
  app.get('/api/v1/sites', async (req, reply) => {
    const sites = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(`
        SELECT s.id, s.name, s.county, s.heritage_status,
               count(DISTINCT b.id)::int AS buildings,
               count(DISTINCT z.id)::int AS zones,
               count(DISTINCT e.id) FILTER (WHERE e.ended_at IS NULL)::int AS active_excursions
          FROM est_site s
          LEFT JOIN est_building b ON b.site_id = s.id
          LEFT JOIN est_floor f ON f.building_id = b.id
          LEFT JOIN est_space sp ON sp.floor_id = f.id
          LEFT JOIN cc_zone z ON z.space_id = sp.id
          LEFT JOIN cc_excursion e ON e.cc_zone_id = z.id
         GROUP BY s.id ORDER BY s.name`);
      return rows;
    });
    return reply.send({
      sites: sites.map((s) => ({ ...s, status: s.active_excursions > 0 ? 'crit' : 'ok' })),
    });
  });

  app.get('/api/v1/compliance', async (req, reply) => {
    const items = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(`
        SELECT o.type, o.frequency, o.next_due, o.status_rag, b.name AS building
          FROM cmp_obligation o LEFT JOIN est_building b ON b.id = o.building_id
         ORDER BY o.next_due ASC`);
      return rows;
    });
    return reply.send({ obligations: items });
  });

  app.get('/api/v1/projects', async (req, reply) => {
    const items = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(`
        SELECT name, cwmf_stage, budget, spend, status_rag,
               CASE WHEN budget > 0 THEN round((spend / budget) * 100) ELSE 0 END AS spend_pct
          FROM prj_project ORDER BY budget DESC`);
      return rows;
    });
    return reply.send({ projects: items });
  });
}
