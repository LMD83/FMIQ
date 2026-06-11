// P2 — Met Éireann predictive pre-conditioning (reactive → preventive).
import { describe, expect, it } from 'vitest';
import { parseMetEireannForecast } from '../src/adapters/metEireann.js';
import { assessPreconditioning } from '../src/domain/preconditioning.js';

const BAND = { rh_min: 45, rh_max: 55, temp_min: 18, temp_max: 22 };
const now = new Date('2026-07-01T00:00:00Z');
const future = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

describe('Met Éireann adapter', () => {
  it('parses a forecast series', () => {
    const fc = parseMetEireannForecast({ forecast: [{ dateTime: future(6), temperature: 19, humidity: 80 }] });
    expect(fc).toHaveLength(1);
    expect(fc[0].rh).toBe(80);
  });
});

describe('pre-conditioning assessment', () => {
  it('recommends dehumidify ahead of an incoming high-RH front', () => {
    const fc = [{ ts: future(6), rh: 90 }]; // projected indoor ~ midpoint + 0.5*(90-50) = 70 > 55
    const actions = assessPreconditioning(BAND, fc, now);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ metric: 'rh', action: 'dehumidify' });
    expect(actions[0].leadHours).toBe(6);
  });

  it('recommends humidify ahead of a dry front', () => {
    const actions = assessPreconditioning(BAND, [{ ts: future(12), rh: 10 }], now);
    expect(actions[0].action).toBe('humidify');
  });

  it('recommends cool/heat for temperature extremes', () => {
    const hot = assessPreconditioning(BAND, [{ ts: future(6), tempC: 40 }], now);
    expect(hot[0].action).toBe('cool');
    const cold = assessPreconditioning(BAND, [{ ts: future(6), tempC: -5 }], now);
    expect(cold[0].action).toBe('heat');
  });

  it('ignores past points and in-band forecasts', () => {
    const actions = assessPreconditioning(BAND, [
      { ts: future(-2), rh: 95 }, // past
      { ts: future(6), rh: 50 }, // in band
    ], now);
    expect(actions).toHaveLength(0);
  });
});
