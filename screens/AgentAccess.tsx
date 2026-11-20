import { useEffect, useState, type FormEvent } from 'react';
import { AgentPermissions } from '../components/AgentAccess/AgentPermissions';
import { BackButton } from '../components/BackButton';
import { NeoButton } from '../components/NeoButton';
import { NeoCard } from '../components/NeoCard';
import { NeoInput } from '../components/NeoInput';
import { useAuth } from '../context/AuthContext';
import { permissionLabels } from '../utils/agentPermissions';
import { supabase } from '../utils/supabase';

type AgentToken = {
  id: string;
  label: string;
  scopes: string[];
  expires_at: string;
  refresh_expires_at: string | null;
  revoked_at: string | null;
};
type AgentEdit = {
  id: number;
  token_id: string;
  operation: string;
  transaction_id: string | null;
  resource_id: string | null;
  created_at: string;
};

const activityLabels: Record<string, string> = {
  'transactions.add': 'added an expense', 'transactions.edit': 'edited an expense', 'transactions.move': 'changed an expense’s friend or payer',
  'transactions.delete': 'deleted a transaction', 'friends.add': 'added a friend', 'friends.edit': 'edited a friend',
  'friends.delete': 'deleted a friend and their history', 'categories.add': 'added a category',
  'categories.delete': 'deleted a category', 'settlements.add': 'recorded a settlement',
  'profile.edit': 'updated your profile', 'data.export': 'exported transaction history', 'data.clear': 'cleared account history',
};

export function AgentAccess() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tokens, setTokens] = useState<AgentToken[] | null>(null);
  const [edits, setEdits] = useState<AgentEdit[]>([]);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(['transactions:add']);
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; scopes: string[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void Promise.all([
      supabase.from('agent_tokens').select('id,label,scopes,expires_at,refresh_expires_at,revoked_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).abortSignal(controller.signal),
      supabase.from('agent_edits').select('id,token_id,operation,transaction_id,resource_id,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false })
        .limit(20).abortSignal(controller.signal),
    ]).then(([tokenResult, editResult]) => {
      if (controller.signal.aborted) return;
      if (tokenResult.error || editResult.error) {
        setError('Could not load agent access. Try refreshing.');
        return;
      }
      setTokens(tokenResult.data);
      setEdits(editResult.data);
    });
    return () => controller.abort();
  }, [userId, refresh]);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !label.trim() || scopes.length === 0) return;
    setError('');
    setStatus('');
    setPending('create');
    try {
      const { data, error } = await supabase.rpc('create_agent_token', { p_label: label, p_scopes: scopes });
      if (error || !data) throw new Error('Agent token creation failed');
      const { token, ...details } = data as AgentToken & { token: string };
      setTokens((current) => [{ ...details, refresh_expires_at: null }, ...(current ?? [])]);
      setSecret({ id: details.id, value: token });
      setLabel('');
    } catch {
      setError('Could not create the token. Try refreshing before you try again.');
    } finally {
      setPending(null);
    }
  }

  async function revokeToken(id: string) {
    setError('');
    setStatus('');
    setPending(id);
    try {
      const { data, error } = await supabase.rpc('revoke_agent_token', { p_id: id });
      if (error || !data) throw new Error('Agent token revocation failed');
      setTokens((current) => current?.map((token) => token.id === id ? { ...token, revoked_at: data } : token) ?? null);
      setEditing((current) => current?.id === id ? null : current);
      setSecret((current) => current?.id === id ? null : current);
      setStatus('Agent access revoked.');
    } catch {
      setError('Could not revoke access. Try again.');
    } finally {
      setPending(null);
    }
  }

  async function savePermissions() {
    if (!editing || !editing.scopes.length) return;
    setError('');
    setStatus('');
    setPending(editing.id);
    try {
      const { error } = await supabase.rpc('update_agent_scopes', { p_id: editing.id, p_scopes: editing.scopes });
      if (error) throw new Error(error.message);
      setTokens((current) => current?.map((token) => token.id === editing.id ? { ...token, scopes: editing.scopes } : token) ?? null);
      setEditing(null);
      setStatus('Permissions updated.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update permissions.');
    } finally {
      setPending(null);
    }
  }

  async function copy(value: string, message: string) {
    setStatus('');
    setError('');
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message);
    } catch {
      setError('Select the text and copy it manually.');
    }
  }

  const labels = new Map(tokens?.map(({ id, label }) => [id, label]));
  const instructions = `Connect to SquareOne. Run node cli/squareone.mjs connect --url ${window.location.origin} --name "My expense agent" and give me the browser approval link.`;

  return (
    <div className="min-h-screen pb-24 bg-neo-bg dark:bg-zinc-950 font-display dark:text-zinc-100">
      <header className="flex items-center gap-4 p-6">
        <BackButton to="/profile" />
        <h1 className="text-xl font-black uppercase tracking-wide">Agent Access</h1>
      </header>
      <main className="mx-auto max-w-2xl px-6 flex flex-col gap-6">
        <NeoCard>
          <h2 className="font-black uppercase mb-2">Connect an agent</h2>
          <p className="text-sm mb-3">Send these instructions to your agent. Open the link it gives you and approve the permissions you want.</p>
          <p className="mb-3 break-words border-2 border-black/20 dark:border-white/20 p-3 text-sm">{instructions}</p>
          <NeoButton type="button" onClick={() => void copy(instructions, 'Connection instructions copied.')}>Copy instructions</NeoButton>
          {status && <p role="status" className="mt-3 text-sm">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        </NeoCard>

        <NeoCard>
          <h2 className="font-black uppercase mb-2">Connected agents & tokens</h2>
          {tokens === null && <p className="text-sm">{error ? 'Agent access unavailable.' : 'Loading agents…'}</p>}
          {tokens?.length === 0 && <p className="text-sm">No agents connected yet.</p>}
          <ul className="divide-y divide-black/20 dark:divide-white/20">
            {tokens?.map((token) => {
              const connected = !!token.refresh_expires_at;
              const expires = token.refresh_expires_at ?? token.expires_at;
              const expired = Date.parse(expires) <= Date.now();
              return (
                <li key={token.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 break-words">
                      <p className="font-bold">{token.label}</p>
                      <p className="text-sm">{connected ? 'Browser connection' : 'Manual token'} ·{' '}
                        {token.revoked_at ? 'Revoked' : expired ? 'Expired' :
                          connected ? 'Active' : `Expires ${new Date(expires).toLocaleDateString()}`}</p>
                      <p className="text-sm">{token.scopes.map((scope) => permissionLabels[scope]).join(', ')}</p>
                    </div>
                    {!token.revoked_at && !expired && (
                      <div className="flex flex-wrap gap-2">
                        <NeoButton type="button" variant="neutral" aria-label={`Edit permissions for ${token.label}`} disabled={!!pending}
                          onClick={() => setEditing({ id: token.id, scopes: token.scopes })}>Permissions</NeoButton>
                        <NeoButton type="button" variant="neutral" aria-label={`Revoke ${token.label}`} disabled={!!pending}
                          onClick={() => void revokeToken(token.id)}>{connected ? 'Disconnect' : 'Revoke'}</NeoButton>
                      </div>
                    )}
                  </div>
                  {editing?.id === token.id && (
                    <div className="mt-4">
                      <AgentPermissions value={editing.scopes} onChange={(value) => setEditing({ id: token.id, scopes: value })} disabled={!!pending} />
                      <div className="flex flex-wrap gap-3">
                        <NeoButton type="button" disabled={!editing.scopes.length || !!pending} onClick={() => void savePermissions()}>
                          Save permissions
                        </NeoButton>
                        <NeoButton type="button" variant="neutral" disabled={!!pending} onClick={() => setEditing(null)}>Cancel</NeoButton>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </NeoCard>

        <NeoCard>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-black uppercase">Recent agent activity</h2>
            <button type="button" className="text-sm font-bold underline" disabled={!!pending} onClick={() => {
              setError('');
              setTokens(null);
              setRefresh((value) => value + 1);
            }}>Refresh</button>
          </div>
          {tokens !== null && edits.length === 0 && <p className="text-sm">No agent activity yet.</p>}
          <ul className="divide-y divide-black/20 dark:divide-white/20">
            {edits.map((edit) => (
              <li key={edit.id} className="py-2 text-sm">
                <p className="break-words"><strong>{labels.get(edit.token_id) ?? 'Agent'}</strong>{' '}
                  {activityLabels[edit.operation] ?? 'completed an action'} on {new Date(edit.created_at).toLocaleDateString()}.</p>
                <p className="break-all text-xs font-mono">{edit.transaction_id ?? edit.resource_id}</p>
              </li>
            ))}
          </ul>
        </NeoCard>

        <NeoCard>
          <details open={secret ? true : undefined}>
            <summary className="cursor-pointer font-black uppercase">Create a manual token</summary>
            <p className="mt-2 mb-4 text-sm">Manual tokens expire after 30 days.</p>
            {secret ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold">Save this token in your agent’s secret settings. It’s shown once.</p>
                <NeoInput aria-label="New agent token" readOnly value={secret.value} autoComplete="off"
                  spellCheck={false} className="font-mono text-sm" onFocus={(event) => event.target.select()} />
                <NeoButton type="button" onClick={() => void copy(secret.value, 'Token copied.')}>Copy token</NeoButton>
                <NeoButton type="button" variant="neutral" onClick={() => { setSecret(null); setStatus(''); setError(''); }}>I’ve saved it</NeoButton>
              </div>
            ) : (
              <form onSubmit={createToken}>
                <NeoInput label="Token name" aria-label="Token name" value={label} onChange={(event) => setLabel(event.target.value)}
                  maxLength={60} required disabled={!!pending} />
                <AgentPermissions value={scopes} onChange={setScopes} disabled={!!pending} />
                <NeoButton type="submit" disabled={!!pending || tokens === null || scopes.length === 0 || !label.trim()}
                  isLoading={pending === 'create'}>Create token</NeoButton>
              </form>
            )}
          </details>
        </NeoCard>
      </main>
    </div>
  );
}
