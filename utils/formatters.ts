const moneyFmt = new Map<string, Intl.NumberFormat>();

/** Format a number as currency. HKD-first app, so HKD by default. */
export function formatCurrency(amount: number, currency = 'HKD'): string {
  let f = moneyFmt.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-HK', { style: 'currency', currency });
    moneyFmt.set(currency, f);
  }
  return f.format(amount);
}

/**
 * Format a date string or object into a human-readable format
 */
export function formatDate(date: string | Date, variant: 'short' | 'long' | 'relative' = 'long'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid date';

  if (variant === 'short') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (variant === 'relative') {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
