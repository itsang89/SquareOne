import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Account, Category, Entry, EntryInput, Friend, Subscription, SubscriptionInput,
} from '../types';
import { friendBalancesMap, getLastActivity } from '../utils/calculations';
import { supabase } from '../utils/supabase';
import { AuthContext } from './AuthContext';

export type Result = { success: boolean; error?: Error };
export type IdResult = Result & { id?: string };

interface FriendRow { id: string; user_id: string; name: string; avatar: string | null }

interface AppContextType {
  // Data
  friends: Friend[]; // with balance (they owe me) / lastActivity / status
  accounts: Account[];
  categories: Category[];
  entries: Entry[]; // newest first, shares attached
  subscriptions: Subscription[];
  loading: boolean;
  error: Error | null;
  isProcessing: boolean;
  refetch: () => Promise<void>;
  // Entries
  addEntry: (input: EntryInput) => Promise<IdResult>;
  updateEntry: (entry: Entry) => Promise<Result>;
  deleteEntry: (id: string) => Promise<Result>;
  // Accounts
  addAccount: (input: { name: string; currency?: string; sort?: number }) => Promise<IdResult>;
  updateAccount: (id: string, updates: Partial<Omit<Account, 'id'>>) => Promise<Result>;
  deleteAccount: (id: string) => Promise<Result>; // fails if entries reference it; archive instead
  // Categories
  addCategory: (input: Pick<Category, 'name' | 'kind'> & Partial<Pick<Category, 'icon' | 'color' | 'sort'>>) => Promise<IdResult>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => Promise<Result>;
  deleteCategory: (id: string) => Promise<Result>; // entries become uncategorised
  // Subscriptions
  addSubscription: (input: SubscriptionInput) => Promise<IdResult>;
  updateSubscription: (id: string, updates: Partial<Omit<Subscription, 'id'>>) => Promise<Result>;
  deleteSubscription: (id: string) => Promise<Result>;
  // Friends
  addFriend: (friend: Omit<Friend, 'id' | 'balance' | 'lastActivity' | 'status'>) => Promise<IdResult>;
  updateFriend: (friendId: string, updates: Partial<Friend>) => Promise<Result>;
  deleteFriend: (friendId: string) => Promise<Result>;
  getFriendById: (friendId: string) => Friend | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const PAGE = 1000; // PostgREST caps responses at 1000 rows

/** Fetch every row of a query, paging past the server's row cap. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

const toError = (err: unknown, fallback: string): Error =>
  err instanceof Error ? err : new Error((err as { message?: string } | null)?.message || fallback);

const num = (v: unknown) => (typeof v === 'string' ? parseFloat(v) : (v as number));

/* eslint-disable @typescript-eslint/no-explicit-any */
const toAccount = (r: any): Account => ({ id: r.id, name: r.name, currency: r.currency, archived: r.archived, sort: r.sort });
const toCategory = (r: any): Category => ({
  id: r.id, name: r.name, kind: r.kind, icon: r.icon ?? undefined, color: r.color ?? undefined,
  archived: r.archived, sort: r.sort,
});
const toSubscription = (r: any): Subscription => ({
  id: r.id, title: r.title, amount: num(r.amount), currency: r.currency, fxRate: num(r.fx_rate),
  categoryId: r.category_id ?? undefined, accountId: r.account_id ?? undefined, cadence: r.cadence,
  nextDate: r.next_date, active: r.active,
});
const toEntry = (r: any): Entry => ({
  id: r.id, kind: r.kind, occurredAt: r.occurred_at, title: r.title, note: r.note ?? undefined,
  amount: num(r.amount), currency: r.currency, fxRate: num(r.fx_rate),
  accountId: r.account_id ?? undefined, toAccountId: r.to_account_id ?? undefined,
  categoryId: r.category_id ?? undefined, friendId: r.friend_id ?? undefined,
  subscriptionId: r.subscription_id ?? undefined, requestId: r.request_id ?? undefined,
  shares: (r.entry_shares ?? []).map((s: any) => ({ friendId: s.friend_id, amount: num(s.amount) })),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const entryPayload = (e: EntryInput) => ({
  id: e.id, kind: e.kind, occurred_at: e.occurredAt ?? new Date().toISOString(), title: e.title ?? '',
  note: e.note ?? null, amount: e.amount, currency: e.currency ?? 'HKD', fx_rate: e.fxRate ?? 1,
  account_id: e.accountId ?? null, to_account_id: e.toAccountId ?? null, category_id: e.categoryId ?? null,
  friend_id: e.friendId ?? null, subscription_id: e.subscriptionId ?? null, request_id: e.requestId ?? null,
});

const subscriptionRow = (s: Partial<Subscription>) => ({
  ...(s.title !== undefined && { title: s.title }),
  ...(s.amount !== undefined && { amount: s.amount }),
  ...(s.currency !== undefined && { currency: s.currency }),
  ...(s.fxRate !== undefined && { fx_rate: s.fxRate }),
  ...('categoryId' in s && { category_id: s.categoryId ?? null }),
  ...('accountId' in s && { account_id: s.accountId ?? null }),
  ...(s.cadence !== undefined && { cadence: s.cadence }),
  ...(s.nextDate !== undefined && { next_date: s.nextDate }),
  ...(s.active !== undefined && { active: s.active }),
});

const REALTIME_TABLES = ['friends', 'accounts', 'categories', 'entries', 'entry_shares', 'subscriptions'];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const [friendRows, setFriendRows] = useState<FriendRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Tracks which user ID has already had its first data load, so background refreshes don't show skeletons. */
  const loadedUserIdRef = useRef<string | null>(null);
  /** Shared debounce timer for all Realtime subscription callbacks. */
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setFriendRows([]); setAccounts([]); setCategories([]); setEntries([]); setSubscriptions([]);
      setLoading(false);
      loadedUserIdRef.current = null;
      return;
    }

    // Only show the loading skeleton on the first fetch for this user identity.
    const isFirstLoad = loadedUserIdRef.current !== user.id;
    loadedUserIdRef.current = user.id;
    if (isFirstLoad) setLoading(true);
    try {
      const uid = user.id;
      const [friendsRes, accountsRes, categoriesRes, entriesRes, subsRes] = await Promise.all([
        fetchAll<FriendRow>((a, b) => supabase.from('friends').select('*').eq('user_id', uid)
          .order('created_at', { ascending: false }).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('accounts').select('*').eq('user_id', uid)
          .order('sort').order('created_at').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('categories').select('*').eq('user_id', uid)
          .order('sort').order('created_at').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('entries').select('*, entry_shares(friend_id, amount)').eq('user_id', uid)
          .order('occurred_at', { ascending: false }).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('subscriptions').select('*').eq('user_id', uid)
          .order('next_date').order('id').range(a, b)),
      ]);

      const failures = [friendsRes, accountsRes, categoriesRes, entriesRes, subsRes]
        .map((r) => r.error?.message).filter(Boolean);
      failures.forEach((m) => console.warn('Error loading data:', m));
      // Surface a recoverable error; successful results below are still applied.
      setError(failures.length ? new Error(failures.join('; ')) : null);

      // Never overwrite a good snapshot with [] when only one query failed.
      if (!friendsRes.error) setFriendRows(friendsRes.data);
      if (!accountsRes.error) setAccounts(accountsRes.data.map(toAccount));
      if (!categoriesRes.error) setCategories(categoriesRes.data.map(toCategory));
      if (!entriesRes.error) setEntries(entriesRes.data.map(toEntry));
      if (!subsRes.error) setSubscriptions(subsRes.data.map(toSubscription));
    } catch (err: unknown) {
      console.error('Unexpected error loading data:', err);
      setError(toError(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: every table feeds one debounced refresh.
  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = setTimeout(() => void loadData(), 400);
    };
    const channels = REALTIME_TABLES.map((table) =>
      supabase
        .channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` }, schedule)
        .subscribe()
    );
    return () => {
      if (realtimeRefreshTimer.current) {
        clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [user, loadData]);

  const friends = useMemo<Friend[]>(() => {
    const balances = friendBalancesMap(entries);
    return friendRows.map((f) => {
      const balance = balances.get(f.id) ?? 0;
      return {
        id: f.id, user_id: f.user_id, name: f.name, avatar: f.avatar || '', balance,
        lastActivity: getLastActivity(f.id, entries),
        status: Math.abs(balance) < 0.01 ? 'settled' : 'active',
      };
    });
  }, [friendRows, entries]);

  /** Run a write for the signed-in user, then reload. Never throws. */
  const write = useCallback(
    async <T extends object = object>(label: string, fn: (uid: string) => Promise<T | void>): Promise<Result & T> => {
      if (!user) return { success: false, error: new Error('User not authenticated') } as Result & T;
      setIsProcessing(true);
      try {
        const extra = await fn(user.id);
        await loadData();
        return { success: true, ...(extra ?? {}) } as Result & T;
      } catch (err: unknown) {
        console.error(`Error ${label}:`, err);
        return { success: false, error: toError(err, `Failed ${label}`) } as Result & T;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, loadData]
  );

  const ok = ({ error }: { error: { message: string } | null }) => {
    if (error) throw error;
  };

  // ---- Entries ----
  const saveEntry = useCallback(
    async (input: EntryInput): Promise<string> => {
      const { data, error } = await supabase.rpc('save_entry', {
        p_entry: entryPayload(input),
        p_shares: (input.shares ?? []).map((s) => ({ friend_id: s.friendId, amount: s.amount })),
      });
      if (error) throw error;
      return data as string;
    },
    []
  );

  const addEntry = useCallback((input: EntryInput) => write('adding entry', async () => ({ id: await saveEntry(input) })), [write, saveEntry]);
  const updateEntry = useCallback((entry: Entry) => write('updating entry', async () => { await saveEntry(entry); }), [write, saveEntry]);
  const deleteEntry = useCallback(
    (id: string) => write('deleting entry', async (uid) => ok(await supabase.from('entries').delete().eq('id', id).eq('user_id', uid))),
    [write]
  );

  // ---- Accounts ----
  const addAccount = useCallback<AppContextType['addAccount']>(
    (input) => write('adding account', async (uid) => {
      const { data, error } = await supabase.from('accounts')
        .insert({ user_id: uid, name: input.name.trim(), currency: input.currency ?? 'HKD', sort: input.sort ?? 0 })
        .select('id').single();
      if (error) throw error;
      return { id: data.id as string };
    }),
    [write]
  );
  const updateAccount = useCallback<AppContextType['updateAccount']>(
    (id, u) => write('updating account', async (uid) => ok(await supabase.from('accounts')
      .update({ ...(u.name !== undefined && { name: u.name.trim() }), ...(u.currency !== undefined && { currency: u.currency }),
        ...(u.archived !== undefined && { archived: u.archived }), ...(u.sort !== undefined && { sort: u.sort }) })
      .eq('id', id).eq('user_id', uid))),
    [write]
  );
  const deleteAccount = useCallback(
    (id: string) => write('deleting account', async (uid) => ok(await supabase.from('accounts').delete().eq('id', id).eq('user_id', uid))),
    [write]
  );

  // ---- Categories ----
  const addCategory = useCallback<AppContextType['addCategory']>(
    (input) => write('adding category', async (uid) => {
      const { data, error } = await supabase.from('categories')
        .insert({ user_id: uid, name: input.name.trim(), kind: input.kind, icon: input.icon ?? null, color: input.color ?? null, sort: input.sort ?? 0 })
        .select('id').single();
      if (error) throw error;
      return { id: data.id as string };
    }),
    [write]
  );
  const updateCategory = useCallback<AppContextType['updateCategory']>(
    (id, u) => write('updating category', async (uid) => ok(await supabase.from('categories')
      .update({ ...(u.name !== undefined && { name: u.name.trim() }), ...(u.kind !== undefined && { kind: u.kind }),
        ...('icon' in u && { icon: u.icon ?? null }), ...('color' in u && { color: u.color ?? null }),
        ...(u.archived !== undefined && { archived: u.archived }), ...(u.sort !== undefined && { sort: u.sort }) })
      .eq('id', id).eq('user_id', uid))),
    [write]
  );
  const deleteCategory = useCallback(
    (id: string) => write('deleting category', async (uid) => ok(await supabase.from('categories').delete().eq('id', id).eq('user_id', uid))),
    [write]
  );

  // ---- Subscriptions ----
  const addSubscription = useCallback<AppContextType['addSubscription']>(
    (input) => write('adding subscription', async (uid) => {
      const { data, error } = await supabase.from('subscriptions')
        .insert({ user_id: uid, ...subscriptionRow({ currency: 'HKD', fxRate: 1, active: true, ...input }) })
        .select('id').single();
      if (error) throw error;
      return { id: data.id as string };
    }),
    [write]
  );
  const updateSubscription = useCallback<AppContextType['updateSubscription']>(
    (id, u) => write('updating subscription', async (uid) =>
      ok(await supabase.from('subscriptions').update(subscriptionRow(u)).eq('id', id).eq('user_id', uid))),
    [write]
  );
  const deleteSubscription = useCallback(
    (id: string) => write('deleting subscription', async (uid) => ok(await supabase.from('subscriptions').delete().eq('id', id).eq('user_id', uid))),
    [write]
  );

  // ---- Friends ----
  const addFriend = useCallback<AppContextType['addFriend']>(
    (f) => write('adding friend', async (uid) => {
      const { data, error } = await supabase.from('friends').insert({ user_id: uid, name: f.name, avatar: f.avatar || null }).select('id').single();
      if (error) throw error;
      return { id: data.id as string };
    }),
    [write]
  );
  const updateFriend = useCallback<AppContextType['updateFriend']>(
    (friendId, updates) => write('updating friend', async (uid) => {
      const row: { name?: string; avatar?: string } = {};
      if (updates.name !== undefined) row.name = updates.name;
      if (updates.avatar !== undefined) row.avatar = updates.avatar;
      ok(await supabase.from('friends').update(row).eq('id', friendId).eq('user_id', uid));
    }),
    [write]
  );
  // The database refuses to delete a friend that has any entries or shares (it would rewrite history).
  const deleteFriend = useCallback(
    (friendId: string) => write('deleting friend', async (uid) => ok(await supabase.from('friends').delete().eq('id', friendId).eq('user_id', uid))),
    [write]
  );
  const getFriendById = useCallback((friendId: string) => friends.find((f) => f.id === friendId), [friends]);

  const value = useMemo<AppContextType>(() => ({
    friends, accounts, categories, entries, subscriptions, loading, error, isProcessing, refetch: loadData,
    addEntry, updateEntry, deleteEntry,
    addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory,
    addSubscription, updateSubscription, deleteSubscription,
    addFriend, updateFriend, deleteFriend, getFriendById,
  }), [
    friends, accounts, categories, entries, subscriptions, loading, error, isProcessing, loadData,
    addEntry, updateEntry, deleteEntry, addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory, addSubscription, updateSubscription, deleteSubscription,
    addFriend, updateFriend, deleteFriend, getFriendById,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
