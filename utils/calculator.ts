const sanitize = (expr: string) => expr.replaceAll('÷', '/').replaceAll('×', '*').replaceAll('−', '-').replace(/[^-0-9+*/.]/g, '');

export type ExpressionResult =
  | { status: 'valid'; value: number }
  | { status: 'incomplete' }
  | { status: 'invalid'; reason: 'division-by-zero' | 'syntax' };

export function calculateExpression(expr: string): ExpressionResult {
  const input = sanitize(expr);
  if (!input || /[+*/-]$/.test(input)) return { status: 'incomplete' };

  const invalid = { status: 'invalid', reason: 'syntax' } as const;
  const number = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)/y;
  const readNumber = (start: number) => {
    number.lastIndex = start;
    const match = number.exec(input);
    return match ? Number(match[0]) : NaN;
  };

  let term = readNumber(0);
  let sum = 0;
  let sign = 1;
  let cursor = number.lastIndex;
  if (!Number.isFinite(term)) return invalid;

  while (cursor < input.length) {
    const op = input[cursor];
    if (!'+-*/'.includes(op)) return invalid;
    const next = readNumber(cursor + 1);
    if (!Number.isFinite(next)) return invalid;
    cursor = number.lastIndex;

    if (op === '/' && next === 0) return { status: 'invalid', reason: 'division-by-zero' };
    if (op === '*') term *= next;
    else if (op === '/') term /= next;
    else {
      sum += sign * term;
      sign = op === '+' ? 1 : -1;
      term = next;
    }
  }

  const value = Math.round((sum + sign * term) * 100) / 100;
  return Number.isFinite(value) ? { status: 'valid', value } : invalid;
}

/** True if the expression has no trailing binary operator (complete for evaluation as a number). */
export function isCompleteNumericExpression(expr: string): boolean {
  const input = sanitize(expr);
  return !!input && !/[+*/-]$/.test(input);
}

/** Legacy string result used by amount validation. */
export function evaluateExpression(expr: string): string {
  const result = calculateExpression(expr);
  if (result.status === 'valid') return String(result.value);
  return result.status === 'incomplete' ? sanitize(expr) || '0' : '0';
}
