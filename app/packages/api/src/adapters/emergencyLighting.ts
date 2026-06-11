import { z } from 'zod';

/**
 * Emergency-lighting adapter (I.S. 3217). Addressable systems log a monthly self-test
 * and an annual discharge test per luminaire. Parse to pass/fail items; domain feeds
 * them into the compliance inspection loop (a fail auto-raises a remedial WO).
 */
export interface EmergencyLightingTest {
  externalId: string;
  testType: 'monthly' | 'annual';
  luminaires: { ref: string; pass: boolean; note?: string }[];
}

const schema = z.object({
  system_id: z.string(),
  test_type: z.enum(['monthly', 'annual']).optional(),
  luminaires: z.array(z.object({ ref: z.string(), pass: z.boolean(), note: z.string().optional() })),
});

export function parseEmergencyLightingTest(payload: unknown): EmergencyLightingTest {
  const b = schema.parse(payload);
  return { externalId: b.system_id, testType: b.test_type ?? 'monthly', luminaires: b.luminaires };
}
