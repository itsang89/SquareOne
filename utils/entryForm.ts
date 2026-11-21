import type { Entry } from '../types';
import { round2 } from './calculations';

export function settlementAmount(balanceHkd: number, rate: number): number {
  return rate > 0 ? round2(balanceHkd / rate) : 0;
}

export function offsetAmount(amount: number, rate: number): number {
  return round2(amount * rate);
}

// AppContext supplies entries newest first.
export function recentEntryTemplates(entries: Entry[]): Entry[] {
  const recent: Entry[] = [];
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.title, entry.categoryId, entry.amount]);
    if (keys.has(key)) continue;
    keys.add(key);
    recent.push(entry);
    if (recent.length === 3) break;
  }
  return recent;
}
