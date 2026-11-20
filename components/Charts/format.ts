export const hkd = (n: number, signed = false): string =>
  (signed && n > 0 ? '+' : '') +
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

/** Chart axis ticks: 1.2k, 3M. */
export const compact = (n: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Same family as the category tiles (utils/categoryStyle.ts), cycled by rank. Red is reserved for alerts.
export const PALETTE = ['#FFD23F', '#82B8FF', '#FF9F7A', '#62E3A4', '#C9B8FF', '#FFB3D1', '#7FDDE0', '#C8EB6A'];
export const UNCAT_COLOR = '#9CA3AF';
export const INCOME_COLOR = '#62E3A4';
export const EXPENSE_COLOR = '#FFD23F';
export const INCOME_PALETTE = ['#62E3A4', '#7FDDE0', '#C8EB6A', '#82B8FF', '#FFD23F', '#C9B8FF', '#FFB3D1', '#FF9F7A'];
