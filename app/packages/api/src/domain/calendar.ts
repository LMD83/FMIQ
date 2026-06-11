import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

/**
 * Calendar / booking service (Tier-0). A first-class store of time-windowed events
 * (PPM visits, inspections, contractor attendance, permit windows, room/resource).
 * A Postgres exclusion constraint guarantees no two active bookings overlap in the
 * same space. Modules emit a domain event; the calendar subscribes and books.
 * See docs/FMIQ-master-build-plan.md §3.3.
 */

export type BookingType = 'ppm' | 'wo_attendance' | 'inspection' | 'permit_window' | 'resource' | 'room';

export interface BookingInput {
  bookingType: BookingType;
  startAt: string;
  endAt: string;
  spaceId?: string | null;
  siteId?: string | null;
  subjectId?: string | null;
  subjectType?: string | null;
  organiserId?: string | null;
  attendees?: unknown[];
  rrule?: string | null;
  icsUid?: string | null;
}

export interface Booking {
  id: string;
  booking_type: BookingType;
  space_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  ics_uid: string | null;
}

export class BookingConflictError extends Error {
  constructor(message = 'Booking conflicts with an existing one in this space.') {
    super(message);
    this.name = 'BookingConflictError';
  }
}

export async function createBooking(client: PoolClient, tenantId: string, input: BookingInput): Promise<Booking> {
  try {
    const { rows } = await client.query<Booking>(
      `INSERT INTO cal_booking
         (tenant_id, booking_type, subject_id, subject_type, site_id, space_id, organiser_id, attendees, start_at, end_at, rrule, ics_uid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, booking_type, space_id, start_at, end_at, status, ics_uid`,
      [
        tenantId,
        input.bookingType,
        input.subjectId ?? null,
        input.subjectType ?? null,
        input.siteId ?? null,
        input.spaceId ?? null,
        input.organiserId ?? null,
        JSON.stringify(input.attendees ?? []),
        input.startAt,
        input.endAt,
        input.rrule ?? null,
        input.icsUid ?? `fmiq-${randomUUID()}`,
      ],
    );
    return rows[0];
  } catch (err) {
    // 23P01 = exclusion_violation (overlapping booking in the same space)
    if ((err as { code?: string }).code === '23P01') throw new BookingConflictError();
    throw err;
  }
}

export async function listBookings(
  client: PoolClient,
  _tenantId: string,
  filter: { spaceId?: string; from?: string; to?: string } = {},
): Promise<Booking[]> {
  const { rows } = await client.query<Booking>(
    `SELECT id, booking_type, space_id, start_at, end_at, status, ics_uid
       FROM cal_booking
      WHERE status <> 'cancelled'
        AND ($1::uuid IS NULL OR space_id = $1)
        AND ($2::timestamptz IS NULL OR end_at >= $2)
        AND ($3::timestamptz IS NULL OR start_at <= $3)
      ORDER BY start_at`,
    [filter.spaceId ?? null, filter.from ?? null, filter.to ?? null],
  );
  return rows;
}

export async function cancelBooking(client: PoolClient, _tenantId: string, id: string): Promise<boolean> {
  const { rowCount } = await client.query(`UPDATE cal_booking SET status = 'cancelled', updated_at = now() WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
