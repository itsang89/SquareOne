import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchEntryFx } from './entryFx';

afterEach(() => vi.unstubAllGlobals());

describe('fetchEntryFx', () => {
  it('returns the quoted business date and caches by currency and requested date', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      base: 'USD', date: '2026-11-20', rates: { HKD: 7.83891234 },
    }));
    vi.stubGlobal('fetch', fetch);

    const rate = fetchEntryFx('USD', '2026-11-21');
    expect(fetchEntryFx('USD', '2026-11-21')).toBe(rate);
    await expect(rate).resolves.toEqual({ date: '2026-11-20', rate: 7.838912 });
    await fetchEntryFx('USD', '2026-11-20');
    await fetchEntryFx('EUR', '2026-11-20');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-11-21?from=USD&to=HKD', expect.anything(),
    );
  });

  it('allows fallback on errors and retries a previously failed lookup', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(Response.json({ base: 'GBP', date: '2026-11-20', rates: { HKD: 10 } }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchEntryFx('GBP', '2026-11-20')).resolves.toBeUndefined();
    await expect(fetchEntryFx('GBP', '2026-11-20')).resolves.toEqual({ date: '2026-11-20', rate: 10 });
  });
});
