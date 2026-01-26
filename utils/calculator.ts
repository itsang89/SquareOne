/**
 * Safely evaluates a mathematical expression string.
 * Supports basic operators: +, -, *, /
 */
export function evaluateExpression(expr: string): string {
  try {
    // Sanitize to only allow numbers and operators
    const sanitized = expr.replace(/[^-0-9+*/.]/g, '');
    if (!sanitized) return '0';
    
    // Don't evaluate if it ends with an operator (it's incomplete)
    if (/[+*/-]$/.test(sanitized)) {
      // For incomplete expressions, we can still try to evaluate the part before the operator
      // but it's safer to just return as is if we expect a number.
      // However, for the final submission, we should try to evaluate or return 0.
      return sanitized;
    }
    
    // Use Function constructor for evaluation
    const result = new Function(`return ${sanitized}`)();
    
    if (!isFinite(result) || isNaN(result)) return '0';
    
    // Format to max 2 decimal places
    return (Math.round(result * 100) / 100).toString();
  } catch {
    return expr;
  }
}
