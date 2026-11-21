export interface EntryFx {
  date: string;
  rate: number;
}

const cache = new Map<string, Promise<EntryFx | undefined>>();

export function fetchEntryFx(currency: string, day: string): Promise<EntryFx | undefined> {
  const key = `${currency}:${day}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // The legacy .app redirect omits CORS headers. Call its v1 destination directly.
  const lookup = fetch(`https://api.frankfurter.dev/v1/${day}?from=${encodeURIComponent(currency)}&to=HKD`, {
    signal: AbortSignal.timeout(5000),
  }).then(async (response) => {
    if (!response.ok) throw new Error('Rate unavailable');
    const data = await response.json();
    const rate = data.rates?.HKD;
    if (
      data.base !== currency || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > day
      || typeof rate !== 'number' || !Number.isFinite(rate)
    ) throw new Error('Invalid rate');
    const rounded = Number(rate.toFixed(6));
    if (rounded <= 0 || rounded >= 1e8) throw new Error('Rate out of range');
    return { date: data.date as string, rate: rounded };
  }).catch(() => {
    cache.delete(key);
    return undefined;
  });

  cache.set(key, lookup);
  return lookup;
}
