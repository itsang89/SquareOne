import type { Entry } from '../types';
import { round2 } from './calculations';

export function settlementAmount(balanceHkd: number, rate: number): number {
  balanceHkd = round2(balanceHkd); // edit mode adds floats: 0.01 + 0.06 = 0.06999…
  if (balanceHkd <= 0 || rate <= 0) return 0;
  const nearest = round2(balanceHkd / rate);
  return round2(nearest * rate) <= balanceHkd ? nearest : round2(nearest - 0.01);
}

export function offsetAmount(amount: number, rate: number): number {
  return round2(amount * rate);
}

// AppContext supplies entries newest first.
export function recentEntryTemplates(entries: Entry[], limit = 5): Entry[] {
  const recent: Entry[] = [];
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.title, entry.categoryId, entry.amount]);
    if (keys.has(key)) continue;
    keys.add(key);
    recent.push(entry);
    if (recent.length === limit) break;
  }
  return recent;
}
