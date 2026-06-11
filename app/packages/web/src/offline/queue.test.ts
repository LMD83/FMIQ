import { describe, expect, it } from 'vitest';
import { OfflineQueue, memoryStorage, type QueuedAction } from './queue';

describe('OfflineQueue', () => {
  it('enqueues and lists pending actions in order', async () => {
    const q = new OfflineQueue(memoryStorage());
    await q.enqueue('wo_status', { id: 'a', status: 'in_progress' });
    await q.enqueue('photo', { woId: 'a' });
    const pending = await q.pending();
    expect(pending).toHaveLength(2);
    expect(pending[0].kind).toBe('wo_status');
  });

  it('flush removes successfully-sent actions', async () => {
    const q = new OfflineQueue(memoryStorage());
    await q.enqueue('ack', { ref: 'WO-1' });
    await q.enqueue('ack', { ref: 'WO-2' });
    const res = await q.flush(async () => undefined);
    expect(res).toEqual({ sent: 2, failed: 0 });
    expect(await q.pending()).toHaveLength(0);
  });

  it('keeps actions that fail to send (at-least-once)', async () => {
    const q = new OfflineQueue(memoryStorage());
    await q.enqueue('wo_status', { id: 'x' });
    const res = await q.flush(async () => {
      throw new Error('offline');
    });
    expect(res).toEqual({ sent: 0, failed: 1 });
    expect(await q.pending()).toHaveLength(1);
  });

  it('flushes partially — only the failures remain', async () => {
    const q = new OfflineQueue(memoryStorage());
    await q.enqueue('wo_status', { id: 'ok' });
    await q.enqueue('wo_status', { id: 'bad' });
    const res = await q.flush(async (a: QueuedAction) => {
      if ((a.payload as { id: string }).id === 'bad') throw new Error('boom');
    });
    expect(res.sent).toBe(1);
    expect(res.failed).toBe(1);
    const left = await q.pending();
    expect(left).toHaveLength(1);
    expect((left[0].payload as { id: string }).id).toBe('bad');
  });
});
