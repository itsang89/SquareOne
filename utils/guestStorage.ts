import type { Friend, Transaction } from '../types';

export const GUEST_STORAGE_KEY = 'squareone_guest_data';

export type GuestPersistedFriend = Pick<Friend, 'id' | 'name' | 'avatar'>;

export interface GuestPersistedSnapshot {
  friends: GuestPersistedFriend[];
  transactions: Transaction[];
}

export function clearGuestLocalData(): void {
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readGuestSnapshot(): GuestPersistedSnapshot | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestPersistedSnapshot;
    if (!parsed || !Array.isArray(parsed.friends) || !Array.isArray(parsed.transactions)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeGuestSnapshot(snapshot: GuestPersistedSnapshot): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Guest data could not be saved to localStorage', e);
  }
}
