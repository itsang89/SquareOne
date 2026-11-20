import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AgentPermissions } from '../components/AgentAccess/AgentPermissions';
import { FullPageLoading } from '../components/LoadingSpinner';
import { NeoButton } from '../components/NeoButton';
import { NeoCard } from '../components/NeoCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Login } from './Login';

const actionDetails: Record<string, { title: string; summary: (subject?: string) => string }> = {
  'data.export': {
    title: 'Approve history export',
    summary: () => 'This sends your transaction history, including notes, to the agent. Its AI provider may process that data.',
  },
  'data.clear': {
    title: 'Approve clearing history',
    summary: () => 'This permanently deletes your friends and transactions, including settlements.',
  },
  'friends.delete': {
    title: 'Approve friend deletion',
    summary: (subject) => `This permanently deletes ${subject ?? 'the selected friend'} and their transaction history.`,
  },
};

type Request = { label: string; operation?: string; subject?: string };

function ReviewRequest({ code, kind }: { code: string; kind: 'connect' | 'action' }) {
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [scopes, setScopes] = useState(['transactions:add']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void supabase.rpc('agent_browser_request', { p_code: code, p_kind: kind }).abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error) setError(error.message);
        else setRequest(data as Request);
      });
    return () => controller.abort();
  }, [code, kind]);

  async function decide(allow: boolean) {
    setPending(true);
    setError('');
    try {
      const { error } = await supabase.rpc('decide_agent_request', {
        p_code: code, p_kind: kind, p_allow: allow, p_scopes: kind === 'connect' ? scopes : null,
      });
      if (error) throw new Error(error.message);
      setMessage(allow ? kind === 'connect' ? 'Agent connected. You can return to the CLI.' :
        'Action approved. The agent can now repeat its command.' : 'Request declined.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your decision.');
    } finally {
      setPending(false);
    }
  }

  const action = request?.operation ? actionDetails[request.operation] : undefined;
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-10 font-display dark:text-zinc-100">
      <NeoCard>
        <h1 className="mb-3 text-xl font-black uppercase">{action?.title ?? 'Connect an agent'}</h1>
        {request && !message && (
          <>
            <p className="mb-2 break-words text-sm">Agent <strong>{request.label}</strong></p>
            <p className="mb-3 break-words text-sm">Signed in as <strong>{user?.name}</strong> ({user?.email})</p>
            {kind === 'connect' ? (
              <>
                <p className="mb-4 text-sm">Only approve a request you started. Match this code with the one shown by the agent.</p>
                <p className="mb-5 bg-neo-yellow p-2 font-mono text-sm font-bold tracking-widest text-black">{code}</p>
                <AgentPermissions value={scopes} onChange={setScopes} disabled={pending} />
              </>
            ) : action && <p className="mb-4 text-sm">{action.summary(request.subject)}</p>}
            <div className="flex flex-wrap gap-3">
              <NeoButton type="button" disabled={pending || (kind === 'connect' ? scopes.length === 0 : !action)}
                onClick={() => void decide(true)}>Approve</NeoButton>
              <NeoButton type="button" variant="neutral" disabled={pending} onClick={() => void decide(false)}>Decline</NeoButton>
            </div>
          </>
        )}
        {!request && !error && <p role="status" className="text-sm">Loading request…</p>}
        {message && <p role="status" className="mb-3 text-sm font-bold">{message}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <Link to="/profile/agent-access" className="mt-5 inline-block text-sm font-bold underline">Go to Agent Access</Link>
      </NeoCard>
    </main>
  );
}

export function ConnectAgent() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const kind = params.has('action') ? 'action' : 'connect';
  const code = params.get(kind === 'action' ? 'action' : 'code') ?? '';
  if (loading && !user) return <FullPageLoading />;
  if (!/^[A-F0-9]{12}$/.test(code)) {
    return <main className="mx-auto max-w-2xl p-6"><NeoCard>
      <p className="mb-3">Open the approval link from your agent’s CLI.</p>
      <Link to="/profile/agent-access" className="font-bold underline">Go to Agent Access</Link>
    </NeoCard></main>;
  }
  if (!user) return <Login approvalPath={`/connect-agent?${params.toString()}`} />;
  return <ReviewRequest key={`${user.id}:${kind}:${code}`} code={code} kind={kind} />;
}
