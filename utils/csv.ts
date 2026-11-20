/** One spreadsheet-safe CSV cell: leading = + - @ tab CR gets a quote prefix so it can't run as a formula. */
export const csvCell = (value: unknown): string => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');
