-- FMIQ migration 005 — Tier-0 cross-cutting services: calendar/booking + notifications.
-- Target: PostgreSQL 16 (production). Pairs with 005_calendar_notifications.dev.sql.
-- See docs/FMIQ-master-build-plan.md §3.3 (calendar) and §3.4 (notification/confirmation).
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- composite GiST exclusion (tenant_id + range)

-- Calendar / booking: time-windowed events (PPM visits, inspections, attendance, permits).
CREATE TABLE cal_booking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  booking_type  text NOT NULL CHECK (booking_type IN ('ppm','wo_attendance','inspection','permit_window','resource','room')),
  subject_id    uuid,
  subject_type  text,
  site_id       uuid REFERENCES est_site(id),
  space_id      uuid REFERENCES est_space(id),
  organiser_id  uuid REFERENCES core_user(id),
  attendees     jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_at      timestamptz NOT NULL,
  end_at        timestamptz NOT NULL,
  rrule         text,
  status        text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('tentative','confirmed','cancelled','completed')),
  ics_uid       text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  -- No two active bookings may overlap in the same space (per tenant).
  CONSTRAINT cal_booking_no_overlap EXCLUDE USING gist (
    tenant_id WITH =, space_id WITH =, tstzrange(start_at, end_at) WITH &&
  ) WHERE (status <> 'cancelled' AND space_id IS NOT NULL)
);

-- Notification + confirmation receipt (multi-channel; delivery written back to source).
CREATE TABLE ntf_message (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL REFERENCES core_tenant(id),
  recipient_id               uuid REFERENCES core_user(id),
  recipient_role             text,
  channel                    text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','teams','sms')),
  entity_type                text,
  entity_id                  uuid,
  subject                    text NOT NULL,
  body                       text NOT NULL,
  priority                   text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  escalation_after_minutes   int,
  escalation_recipient_role  text,
  escalation_tier            int NOT NULL DEFAULT 0,
  sent_at                    timestamptz NOT NULL DEFAULT now(),
  read_at                    timestamptz
);
CREATE INDEX ix_ntf_message_unread ON ntf_message (tenant_id, sent_at)
  WHERE read_at IS NULL;

CREATE TABLE ntf_confirmation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES core_tenant(id),
  message_id    uuid NOT NULL REFERENCES ntf_message(id),
  confirmed_by  uuid REFERENCES core_user(id),
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  action_taken  text
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cal_booking','ntf_message','ntf_confirmation'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);$p$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_%I_tenant ON %I (tenant_id, id);', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON cal_booking, ntf_message, ntf_confirmation TO fmiq_app;

COMMIT;
