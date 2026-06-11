// S2 — calendar/booking + notification/confirmation services.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTenant } from '../src/db/withTenant.js';
import { createTenant } from './helpers/db.js';
import { BookingConflictError, cancelBooking, createBooking, listBookings } from '../src/domain/calendar.js';
import { acknowledge, dueForEscalation, escalate, notify } from '../src/domain/notifications.js';

let tenant: string;
let spaceA: string;
let spaceB: string;
let userId: string;

beforeAll(async () => {
  tenant = await createTenant('cal');
  await withTenant(tenant, async (c) => {
    const site = (await c.query<{ id: string }>(`INSERT INTO est_site (tenant_id, name) VALUES ($1,'S') RETURNING id`, [tenant])).rows[0].id;
    const b = (await c.query<{ id: string }>(`INSERT INTO est_building (tenant_id, site_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenant, site])).rows[0].id;
    const f = (await c.query<{ id: string }>(`INSERT INTO est_floor (tenant_id, building_id, name) VALUES ($1,$2,'F') RETURNING id`, [tenant, b])).rows[0].id;
    spaceA = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'A','plant') RETURNING id`, [tenant, f])).rows[0].id;
    spaceB = (await c.query<{ id: string }>(`INSERT INTO est_space (tenant_id, floor_id, name, space_type) VALUES ($1,$2,'B','plant') RETURNING id`, [tenant, f])).rows[0].id;
    userId = (await c.query<{ id: string }>(`INSERT INTO core_user (tenant_id, email, display_name) VALUES ($1,'u@test.local','U') RETURNING id`, [tenant])).rows[0].id;
  });
});

afterAll(async () => {
  await pool.end();
});

describe('calendar booking', () => {
  it('rejects overlapping bookings in the same space', async () => {
    await withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'ppm', spaceId: spaceA, startAt: '2026-07-01T09:00:00Z', endAt: '2026-07-01T11:00:00Z' }));
    await expect(
      withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'inspection', spaceId: spaceA, startAt: '2026-07-01T10:00:00Z', endAt: '2026-07-01T12:00:00Z' })),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it('allows the same window in a different space', async () => {
    const b = await withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'ppm', spaceId: spaceB, startAt: '2026-07-01T10:00:00Z', endAt: '2026-07-01T12:00:00Z' }));
    expect(b.id).toBeDefined();
  });

  it('allows an adjacent (non-overlapping) window in the same space', async () => {
    const b = await withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'ppm', spaceId: spaceA, startAt: '2026-07-01T11:00:00Z', endAt: '2026-07-01T12:00:00Z' }));
    expect(b.id).toBeDefined();
  });

  it('lists and cancels bookings; a cancelled slot frees the space', async () => {
    const b = await withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'ppm', spaceId: spaceB, startAt: '2026-08-01T09:00:00Z', endAt: '2026-08-01T10:00:00Z' }));
    const list = await withTenant(tenant, (c) => listBookings(c, tenant, { spaceId: spaceB }));
    expect(list.some((x) => x.id === b.id)).toBe(true);
    expect(await withTenant(tenant, (c) => cancelBooking(c, tenant, b.id))).toBe(true);
    // Re-book the freed window (no conflict because the prior is cancelled).
    const again = await withTenant(tenant, (c) => createBooking(c, tenant, { bookingType: 'ppm', spaceId: spaceB, startAt: '2026-08-01T09:00:00Z', endAt: '2026-08-01T10:00:00Z' }));
    expect(again.id).toBeDefined();
  });
});

describe('notifications', () => {
  it('notify → acknowledge writes a confirmation and marks read', async () => {
    const m = await withTenant(tenant, (c) => notify(c, tenant, { recipientId: userId, subject: 'Excursion', body: 'Action needed', priority: 'critical' }));
    expect(m.read_at).toBeNull();
    const ok = await withTenant(tenant, (c) => acknowledge(c, tenant, m.id, { confirmedBy: userId, actionTaken: 'attended' }));
    expect(ok).toBe(true);
    const conf = await withTenant(tenant, (c) => c.query<{ n: number }>(`SELECT count(*)::int AS n FROM ntf_confirmation WHERE message_id = $1`, [m.id]));
    expect(conf.rows[0].n).toBe(1);
    const read = await withTenant(tenant, (c) => c.query<{ read_at: string | null }>(`SELECT read_at FROM ntf_message WHERE id = $1`, [m.id]));
    expect(read.rows[0].read_at).not.toBeNull();
  });

  it('surfaces unacknowledged messages past their escalation window and bumps the tier', async () => {
    const m = await withTenant(tenant, (c) => notify(c, tenant, { recipientId: userId, subject: 'Tier', body: 'x', escalationAfterMinutes: 15, escalationRecipientRole: 'FacilitiesManager' }));
    // Backdate so it is overdue for tier 0.
    await withTenant(tenant, (c) => c.query(`UPDATE ntf_message SET sent_at = now() - interval '20 minutes' WHERE id = $1`, [m.id]));
    const due = await withTenant(tenant, (c) => dueForEscalation(c, tenant));
    expect(due.some((x) => x.id === m.id)).toBe(true);
    await withTenant(tenant, (c) => escalate(c, tenant, m.id));
    const after = await withTenant(tenant, (c) => c.query<{ escalation_tier: number }>(`SELECT escalation_tier FROM ntf_message WHERE id = $1`, [m.id]));
    expect(after.rows[0].escalation_tier).toBe(1);
  });
});
