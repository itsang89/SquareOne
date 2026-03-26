import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { NeoButton } from './NeoButton';

interface DataLoadErrorBannerProps {
  error: Error | null;
  loading: boolean;
  onRetry: () => void | Promise<void>;
}

/** Inline Neo banner when Supabase data failed to load (not an empty ledger). */
export const DataLoadErrorBanner: React.FC<DataLoadErrorBannerProps> = ({
  error,
  loading,
  onRetry,
}) => {
  if (!error) return null;

  return (
    <div
      className="mx-5 mt-3 px-4 py-3 bg-neo-red/20 dark:bg-neo-red/10 border-2 border-black text-sm font-bold text-black dark:text-zinc-100 shadow-neo-sm flex items-center justify-between gap-3"
      role="alert"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0 text-neo-red" />
        Couldn&apos;t load your data. Check your connection and try again.
      </span>
      <NeoButton
        variant="secondary"
        className="py-1 px-3 text-xs shrink-0"
        isLoading={loading}
        onClick={() => void onRetry()}
      >
        <RefreshCw size={12} />
        Retry
      </NeoButton>
    </div>
  );
};
