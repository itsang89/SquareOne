import { evaluateExpression, isCompleteNumericExpression } from './calculator';

/**
 * Simple email validation
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate transaction amount
 */
export function isValidAmount(amount: string | number): boolean {
  if (typeof amount === 'number') {
    return !isNaN(amount) && amount > 0;
  }

  if (!isCompleteNumericExpression(amount)) return false;
  const evaluated = evaluateExpression(amount);
  const num = parseFloat(evaluated);
  return !isNaN(num) && num > 0;
}
