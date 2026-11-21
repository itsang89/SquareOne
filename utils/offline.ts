import type { Entry } from '../types';

/**
 * Offline support: a per-user snapshot of the last good load, and an outbox of new entries
 * saved while offline. Outbox entries carry their own id, so replaying one is an idempotent upsert.
 * ponytail: localStorage (~5 MB). Move to IndexedDB if the snapshot outgrows it.
 */
const key = (kind: 'cache' | 'outbox', uid: string) => `squareone_${kind}_${uid}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** False when storage is full or blocked. */
function write(k: string, value: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('Offline storage full or blocked:', err);
    return false;
  }
}

export const loadCache = <T>(uid: string): T | null => read<T | null>(key('cache', uid), null);
export const saveCache = (uid: string, snapshot: unknown) => void write(key('cache', uid), snapshot);
/** Drop every user's snapshot (on sign-out). Outboxes stay so unsynced entries are never lost. */
export const clearCaches = () =>
  Object.keys(localStorage).filter((k) => k.startsWith('squareone_cache_')).forEach((k) => localStorage.removeItem(k));

export const loadOutbox = (uid: string): Entry[] => read<Entry[]>(key('outbox', uid), []);
export const saveOutbox = (uid: string, entries: Entry[]) => write(key('outbox', uid), entries);

/** True when a failed request never reached the server (offline, flaky signal). */
export const isNetworkError = (err: unknown): boolean =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) ||
  /failed to fetch|networkerror|load failed|network request failed/i.test(String((err as { message?: string })?.message ?? err));

/** Server entries plus queued ones (marked pending), newest first. A queued entry the server already has wins from the server. */
export function mergePending(server: Entry[], outbox: Entry[]): Entry[] {
  if (outbox.length === 0) return server;
  const known = new Set(server.map((e) => e.id));
  const pending = outbox.filter((e) => !known.has(e.id)).map((e) => ({ ...e, pending: true }));
  return [...pending, ...server].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
