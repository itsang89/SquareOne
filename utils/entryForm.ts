import type { Account, Entry } from '../types';
import { round2 } from './calculations';

export function settlementAmount(balanceHkd: number, rate: number): number {
  if (balanceHkd <= 0 || rate <= 0) return 0;
  const nearest = round2(balanceHkd / rate);
  return round2(nearest * rate) <= balanceHkd ? nearest : round2(nearest - 0.01);
}

export function offsetAmount(amount: number, rate: number): number {
  return round2(amount * rate);
}

export function canRepeatEntry(entry: Entry, accounts: Account[]): boolean {
  return entry.title !== 'Balance adjustment' && !(entry.kind === 'transfer' && accounts.some((account) =>
    account.archived && account.name === 'Balance adjustments'
    && (account.id === entry.accountId || account.id === entry.toAccountId)
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
