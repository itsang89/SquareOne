import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useDraftBack(dirty: boolean) {
  const loc = useLocation();
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const history = window.history;
    const url = window.location.href;
    const arm = () => history.pushState({ ...history.state, entryDraftGuard: true }, '', url);
    // HashRouter cannot block POP. Give browser Back a same-URL stop while this draft is open.
    if (dirty && !history.state?.entryDraftGuard) arm();
    else if (!dirty && !history.state?.entryDraftGuard) return;

    const onPop = (event: PopStateEvent) => {
      if (window.location.href !== url || event.state?.entryDraftGuard || (event.state?.key ?? 'default') !== loc.key) return;
      if (!dirty) {
        if (!history.state?.idx) void nav('/dashboard', { replace: true });
        else history.back();
        return;
      }
      arm();
      setConfirming(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dirty, loc.key, nav]);

  const leave = () => {
    if (!window.history.state?.idx) void nav('/dashboard', { replace: true });
    else void nav(window.history.state?.entryDraftGuard ? -2 : -1);
  };

  return {
    confirming,
    keepEditing: () => setConfirming(false),
    leave,
    back: () => dirty ? setConfirming(true) : leave(),
  };
}
