import { describe, expect, it } from 'vitest';
import { certStatusBadge, classificationBadge, docTypeLabel, priorityBadge, requisitionBadge, shortDate, slaBadge, stockBadge } from './format';

describe('priorityBadge', () => {
  it('maps priorities to tone + label', () => {
    expect(priorityBadge('critical')).toEqual({ tone: 'crit', label: 'Critical' });
    expect(priorityBadge('high')).toEqual({ tone: 'watch', label: 'High' });
    expect(priorityBadge('routine')).toEqual({ tone: 'neutral', label: 'Routine' });
    expect(priorityBadge('anything')).toEqual({ tone: 'neutral', label: 'Routine' });
  });
});

describe('slaBadge', () => {
  const now = new Date('2026-07-01T12:00:00Z');
  it('is Met when closed', () => {
    expect(slaBadge('2026-07-01T13:00:00Z', { closed: true, now })).toEqual({ tone: 'ok', label: 'Met' });
  });
  it('is No SLA when no due date', () => {
    expect(slaBadge(null, { now })).toEqual({ tone: 'neutral', label: 'No SLA' });
  });
  it('is Breached when past due', () => {
    expect(slaBadge('2026-07-01T11:00:00Z', { now })).toEqual({ tone: 'crit', label: 'Breached' });
  });
  it('is At risk at >=75% elapsed', () => {
    // opened 10:00, due 12:30, now 12:00 → 80%
    expect(slaBadge('2026-07-01T12:30:00Z', { openedAt: '2026-07-01T10:00:00Z', now })).toEqual({ tone: 'watch', label: 'At risk' });
  });
  it('is On track at <75% elapsed', () => {
    // opened 11:00, due 13:00, now 12:00 → 50%
    expect(slaBadge('2026-07-01T13:00:00Z', { openedAt: '2026-07-01T11:00:00Z', now })).toEqual({ tone: 'ok', label: 'On track' });
  });
});

describe('docTypeLabel', () => {
  it('humanises known types and passes through unknown', () => {
    expect(docTypeLabel('om_manual')).toBe('O&M manual');
    expect(docTypeLabel('rams')).toBe('RAMS');
    expect(docTypeLabel('mystery')).toBe('mystery');
  });
});

describe('classificationBadge', () => {
  it('maps statutory classes to tones', () => {
    expect(classificationBadge('red').tone).toBe('crit');
    expect(classificationBadge('amber').tone).toBe('watch');
    expect(classificationBadge('green').tone).toBe('ok');
    expect(classificationBadge(null)).toEqual({ tone: 'neutral', label: '—' });
  });
});

describe('certStatusBadge', () => {
  it('maps cert statuses', () => {
    expect(certStatusBadge('valid')).toEqual({ tone: 'ok', label: 'Valid' });
    expect(certStatusBadge('expired')).toEqual({ tone: 'crit', label: 'Expired' });
    expect(certStatusBadge('superseded').tone).toBe('neutral');
  });
});

describe('stockBadge', () => {
  it('flags reorder at/below min, low within 20%, else in stock', () => {
    expect(stockBadge(2, 5)).toEqual({ tone: 'crit', label: 'Reorder' });
    expect(stockBadge(5, 5)).toEqual({ tone: 'crit', label: 'Reorder' });
    expect(stockBadge(6, 5)).toEqual({ tone: 'watch', label: 'Low' }); // 6 <= 6
    expect(stockBadge(20, 5)).toEqual({ tone: 'ok', label: 'In stock' });
    expect(stockBadge(null, 5)).toEqual({ tone: 'neutral', label: '—' });
  });
  it('handles numeric strings (pg returns numeric as string) without lexical bugs', () => {
    expect(stockBadge('24', '10')).toEqual({ tone: 'ok', label: 'In stock' }); // 24 > 12, not lexical "24"<="10"
    expect(stockBadge('2', '3')).toEqual({ tone: 'crit', label: 'Reorder' });
  });
});

describe('requisitionBadge', () => {
  it('maps requisition statuses', () => {
    expect(requisitionBadge('approved').tone).toBe('ok');
    expect(requisitionBadge('rejected').tone).toBe('crit');
    expect(requisitionBadge('pending_approval')).toEqual({ tone: 'watch', label: 'Pending' });
    expect(requisitionBadge('draft')).toEqual({ tone: 'neutral', label: 'Draft' });
  });
});

describe('shortDate', () => {
  it('handles null and invalid', () => {
    expect(shortDate(null)).toBe('—');
    expect(shortDate('not-a-date')).toBe('—');
  });
  it('formats a valid date', () => {
    expect(shortDate('2026-07-01T12:00:00Z')).toMatch(/2026/);
  });
});
