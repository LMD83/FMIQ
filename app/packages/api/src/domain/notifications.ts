import type { PoolClient } from 'pg';

/**
 * Notification + confirmation service (Tier-0). Domain events resolve to recipients,
 * render a message, and dispatch (in-app now; email via ACS, Teams/SMS later). Delivery
 * confirmations are written back to the originating entity and feed the escalation
 * ladder. GDPR: notification bodies never carry collection-object or health detail.
 * See docs/FMIQ-master-build-plan.md §3.4.
 */

export interface NotifyInput {
  recipientId?: string | null;
  recipientRole?: string | null;
  channel?: 'in_app' | 'email' | 'teams' | 'sms';
  entityType?: string | null;
  entityId?: string | null;
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  escalationAfterMinutes?: number | null;
  escalationRecipientRole?: string | null;
}

export interface NotificationMessage {
  id: string;
  subject: string;
  priority: string;
  escalation_tier: number;
  read_at: string | null;
}

export async function notify(client: PoolClient, tenantId: string, input: NotifyInput): Promise<NotificationMessage> {
  const { rows } = await client.query<NotificationMessage>(
    `INSERT INTO ntf_message
       (tenant_id, recipient_id, recipient_role, channel, entity_type, entity_id, subject, body, priority, escalation_after_minutes, escalation_recipient_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, subject, priority, escalation_tier, read_at`,
    [
      tenantId,
      input.recipientId ?? null,
      input.recipientRole ?? null,
      input.channel ?? 'in_app',
      input.entityType ?? null,
      input.entityId ?? null,
      input.subject,
      input.body,
      input.priority ?? 'normal',
      input.escalationAfterMinutes ?? null,
      input.escalationRecipientRole ?? null,
    ],
  );
  return rows[0];
}

export interface AckInput {
  confirmedBy?: string | null;
  actionTaken?: string | null;
}

/** Acknowledge a message: write the confirmation receipt and mark it read. */
export async function acknowledge(client: PoolClient, tenantId: string, messageId: string, input: AckInput): Promise<boolean> {
  const { rowCount } = await client.query(`UPDATE ntf_message SET read_at = now() WHERE id = $1 AND read_at IS NULL`, [messageId]);
  await client.query(
    `INSERT INTO ntf_confirmation (tenant_id, message_id, confirmed_by, action_taken) VALUES ($1,$2,$3,$4)`,
    [tenantId, messageId, input.confirmedBy ?? null, input.actionTaken ?? null],
  );
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, user_id, entity, entity_id, action, after)
     VALUES ($1,$2,'ntf_message',$3,'notification.acknowledged',$4)`,
    [tenantId, input.confirmedBy ?? null, messageId, JSON.stringify({ actionTaken: input.actionTaken ?? null })],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Messages that are unread, have an escalation window, and are past it for their
 * current tier — the escalation ladder's input (re-dispatch up to 3 tiers).
 */
export async function dueForEscalation(client: PoolClient, _tenantId: string): Promise<NotificationMessage[]> {
  const { rows } = await client.query<NotificationMessage>(
    `SELECT id, subject, priority, escalation_tier, read_at
       FROM ntf_message
      WHERE read_at IS NULL
        AND escalation_after_minutes IS NOT NULL
        AND escalation_tier < 3
        AND sent_at + (escalation_after_minutes * (escalation_tier + 1) || ' minutes')::interval <= now()`,
  );
  return rows;
}

/** Bump a message to the next escalation tier (caller re-dispatches to the escalation role). */
export async function escalate(client: PoolClient, _tenantId: string, messageId: string): Promise<void> {
  await client.query(`UPDATE ntf_message SET escalation_tier = escalation_tier + 1 WHERE id = $1`, [messageId]);
}
