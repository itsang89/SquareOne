import type { Account, Entry } from '../types';
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

/** Wallet reconcile's hidden counter-account ("Balance adjustments", "Balance adjustments USD"). ponytail: name-based, no migration. */
export const isAdjustmentAccount = (a: Account): boolean => a.archived && /^Balance adjustments( [A-Z]{3})?$/.test(a.name);

export function canRepeatEntry(entry: Entry, accounts: Account[]): boolean {
  return !(entry.kind === 'transfer' && accounts.some((a) =>
    isAdjustmentAccount(a) && (a.id === entry.accountId || a.id === entry.toAccountId)
  ));
}

// AppContext supplies entries newest first.
export function recentEntryTemplates(entries: Entry[], accounts: Account[]): Entry[] {
  const recent: Entry[] = [];
  const keys = new Set<string>();
  for (const entry of entries) {
    if (!canRepeatEntry(entry, accounts)) continue;
    const key = JSON.stringify([entry.title, entry.categoryId, entry.amount]);
    if (keys.has(key)) continue;
    keys.add(key);
    recent.push(entry);
    if (recent.length === 3) break;
  }
  return recent;
}
