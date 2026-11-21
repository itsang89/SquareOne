import { describe, expect, it } from 'vitest';
import { isNetworkError, mergePending } from './offline';
import type { Entry } from '../types';

const e = (id: string, occurredAt: string): Entry =>
  ({ id, kind: 'expense', occurredAt, title: '', amount: 1, currency: 'HKD', fxRate: 1, shares: [] });

describe('offline outbox', () => {
  it('merges queued entries newest first, marks them pending, and drops ones the server already has', () => {
    const server = [e('s2', '2026-11-20T10:00:00+00:00'), e('s1', '2026-11-18T10:00:00+00:00')];
    const merged = mergePending(server, [e('q1', '2026-11-19T10:00:00.000Z'), e('s2', '2026-11-20T10:00:00.000Z')]);
    expect(merged.map((x) => [x.id, !!x.pending])).toEqual([['s2', false], ['q1', true], ['s1', false]]);
    expect(mergePending(server, [])).toBe(server);
  });

  it('recognises network failures but not server rejections', () => {
    expect(isNetworkError(new Error('TypeError: Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'Load failed' })).toBe(true);
    expect(isNetworkError({ message: 'violates check constraint' })).toBe(false);
  });
});
