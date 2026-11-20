export const hkd = (n: number, signed = false): string =>
  (signed && n > 0 ? '+' : '') +
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

/** Chart axis ticks: 1.2k, 3M. */
export const compact = (n: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// neo colors from tailwind.config.js, cycled by rank
export const PALETTE = ['#FF4D4D', '#FFDE59', '#5CE1E6', '#26C485', '#C3B1E1', '#FF914D', '#FF99C8', '#C3F53C'];
export const UNCAT_COLOR = '#9CA3AF';
export const INCOME_COLOR = '#26C485';
export const EXPENSE_COLOR = '#FF4D4D';
export const INCOME_PALETTE = ['#26C485', '#5CE1E6', '#C3F53C', '#C3B1E1', '#FFDE59', '#FF99C8', '#FF914D', '#FF4D4D'];
