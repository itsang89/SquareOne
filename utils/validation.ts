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
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0;
}

/**
 * Validate required string
 */
export function isRequired(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}
