import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

/** Thin strip while offline or while saved-offline entries wait to sync. */
export const OfflineBanner: React.FC = () => {
  const { online, pendingCount } = useAppContext();
  if (online && pendingCount === 0) return null;
  const waiting = pendingCount > 0 && ` · ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} waiting to sync`;
  return (
    <div role="status" className="px-4 py-2 border-b-2 border-black bg-neo-yellow text-black text-xs font-black uppercase flex items-center gap-2">
      {online ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />}
      {online ? `Syncing${waiting}` : `Offline · new entries save on this device${waiting || ''}`}
    </div>
  );
};
