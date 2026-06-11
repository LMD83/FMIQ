import { z } from 'zod';

/**
 * Fire-alarm panel adapter (I.S. 3218). Addressable panels emit zone activations,
 * faults and test events via serial/Modbus → edge gateway, or a vendor webhook.
 * Parse to a normalised event; domain/lifeSafety.ts turns it into compliance records.
 */
export type FirePanelEventType = 'activation' | 'fault' | 'test';

export interface FirePanelEvent {
  externalId: string;
  eventType: FirePanelEventType;
  zone?: string;
  detail?: string;
  ts?: string;
}

const schema = z.object({
  panel_id: z.string(),
  event: z.string(),
  zone: z.string().optional(),
  detail: z.string().optional(),
  ts: z.string().optional(),
});

export function parseFirePanelEvent(payload: unknown): FirePanelEvent {
  const b = schema.parse(payload);
  const e = b.event.trim().toLowerCase();
  const eventType: FirePanelEventType = e.includes('fault') ? 'fault' : e.includes('test') ? 'test' : 'activation';
  return { externalId: b.panel_id, eventType, zone: b.zone, detail: b.detail, ts: b.ts };
}
