import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { evaluateGates, overrideGate, GateError } from '../domain/gateEngine.js';
import { GateBlockedError, WorkOrderError, transitionWorkOrder } from '../domain/workOrders.js';

export async function workOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/work-orders', async (req, reply) => {
    const wos = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(`
        SELECT w.id, w.ref, w.title, w.source, w.priority, w.status, w.sla_due,
               w.conservation_notes, sp.name AS location, w.opened_at
          FROM wo_work_order w
          LEFT JOIN est_space sp ON sp.id = w.space_id
         ORDER BY
           CASE w.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
           w.opened_at DESC
         LIMIT 200`);
      return rows;
    });
    return reply.send({ workOrders: wos });
  });

  // Preview a gate without side effects — drives the "Ready to start / Blocked" banner.
  app.get('/api/v1/work-orders/:id/gates', async (req, reply) => {
    const { id } = req.params as { id: string };
    const gateCode = (z.object({ gate: z.string().optional() }).parse(req.query).gate) ?? 'ssow_readiness';
    try {
      const evaluation = await withTenant(req.auth.tenantId, (c) =>
        evaluateGates(c, req.auth.tenantId, { gateCode, workOrderId: id }, { persist: false }),
      );
      return reply.send({ gate: evaluation });
    } catch (err) {
      if (err instanceof GateError && err.code === 'unknown_gate') return reply.code(404).send({ error: err.code });
      throw err;
    }
  });

  // The gate-enforced state machine: → in_progress runs the SSoW Readiness Gate.
  const statusSchema = z.object({ status: z.enum(['open', 'assigned', 'in_progress', 'closed']) });
  app.patch('/api/v1/work-orders/:id/status', {
    preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin'),
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        transitionWorkOrder(c, req.auth.tenantId, { workOrderId: id, toStatus: parsed.data.status, actorUserId: req.auth.userId }),
      );
      return reply.send(result);
    } catch (err) {
      if (err instanceof GateBlockedError) {
        return reply.code(409).send({
          error: 'gate_blocked',
          gateCode: err.gateCode,
          message: err.message,
          blockedBy: err.evaluation.blockedBy.map((c) => ({ checkId: c.checkId, message: c.blockMessage })),
        });
      }
      if (err instanceof WorkOrderError) {
        return reply.code(err.code === 'not_found' ? 404 : 409).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Record a documented, audited override of a blocked gate.
  const overrideSchema = z.object({ reason: z.string().min(1) });
  app.post('/api/v1/work-orders/:id/gates/:gateCode/override', {
    preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin'),
  }, async (req, reply) => {
    const { id, gateCode } = req.params as { id: string; gateCode: string };
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        overrideGate(c, req.auth.tenantId, { gateCode, workOrderId: id }, {
          overrideBy: req.auth.userId,
          reason: parsed.data.reason,
          actorRoles: req.auth.roles,
        }),
      );
      return reply.send(result);
    } catch (err) {
      if (err instanceof GateError) {
        const status = err.code === 'override_forbidden' ? 403 : err.code === 'unknown_gate' ? 404 : 400;
        return reply.code(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Acknowledge & dispatch — closes the loop's "Act" step.
  const ackSchema = z.object({ ref: z.string() });
  app.post('/api/v1/work-orders/ack', {
    preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'ConservationOfficer', 'TenantAdmin'),
  }, async (req, reply) => {
    const parsed = ackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
    const updated = await withTenant(req.auth.tenantId, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE wo_work_order SET status = 'assigned', assignee_id = $1
          WHERE ref = $2 AND status = 'open'`,
        [req.auth.userId, parsed.data.ref],
      );
      return rowCount ?? 0;
    });
    return reply.send({ acknowledged: updated > 0 });
  });
}
