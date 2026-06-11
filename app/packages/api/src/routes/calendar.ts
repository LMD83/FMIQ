import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { BookingConflictError, cancelBooking, createBooking, listBookings } from '../domain/calendar.js';

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/bookings', async (req, reply) => {
    const q = z.object({ spaceId: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional() }).safeParse(req.query);
    const bookings = await withTenant(req.auth.tenantId, (c) => listBookings(c, req.auth.tenantId, q.success ? q.data : {}));
    return reply.send({ bookings });
  });

  const createSchema = z.object({
    bookingType: z.enum(['ppm', 'wo_attendance', 'inspection', 'permit_window', 'resource', 'room']),
    startAt: z.string(),
    endAt: z.string(),
    spaceId: z.string().uuid().nullish(),
    siteId: z.string().uuid().nullish(),
  });
  app.post('/api/v1/bookings', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const booking = await withTenant(req.auth.tenantId, (c) => createBooking(c, req.auth.tenantId, { ...parsed.data, organiserId: req.auth.userId }));
      return reply.code(201).send({ booking });
    } catch (err) {
      if (err instanceof BookingConflictError) return reply.code(409).send({ error: 'booking_conflict', message: err.message });
      throw err;
    }
  });

  app.post('/api/v1/bookings/:id/cancel', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const cancelled = await withTenant(req.auth.tenantId, (c) => cancelBooking(c, req.auth.tenantId, id));
    return reply.send({ cancelled });
  });
}
