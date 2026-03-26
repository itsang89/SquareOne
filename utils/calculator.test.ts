import { describe, it, expect } from 'vitest';
import { isCompleteNumericExpression, evaluateExpression } from './calculator';

describe('isCompleteNumericExpression', () => {
  it('accepts a plain integer', () => {
    expect(isCompleteNumericExpression('42')).toBe(true);
  });

  it('accepts a decimal number', () => {
    expect(isCompleteNumericExpression('3.14')).toBe(true);
  });

  it('accepts a negative number', () => {
    expect(isCompleteNumericExpression('-5')).toBe(true);
  });

  it('accepts a complete binary expression', () => {
    expect(isCompleteNumericExpression('1+2')).toBe(true);
    expect(isCompleteNumericExpression('10-3')).toBe(true);
    expect(isCompleteNumericExpression('2*3')).toBe(true);
    expect(isCompleteNumericExpression('10/4')).toBe(true);
  });

  it('rejects an expression ending with an operator', () => {
    expect(isCompleteNumericExpression('5+')).toBe(false);
    expect(isCompleteNumericExpression('5-')).toBe(false);
    expect(isCompleteNumericExpression('5*')).toBe(false);
    expect(isCompleteNumericExpression('5/')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isCompleteNumericExpression('')).toBe(false);
  });

  it('rejects a string that becomes empty after sanitisation', () => {
    expect(isCompleteNumericExpression('abc')).toBe(false);
  });
});

describe('evaluateExpression', () => {
  it('evaluates addition', () => {
    expect(evaluateExpression('1+2')).toBe('3');
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('10-3')).toBe('7');
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('2*3')).toBe('6');
  });

  it('evaluates division', () => {
    expect(evaluateExpression('10/4')).toBe('2.5');
  });

  it('rounds to 2 decimal places', () => {
    expect(evaluateExpression('1/3')).toBe('0.33');
  });

  it('handles decimal operands', () => {
    expect(evaluateExpression('1.5+1.5')).toBe('3');
  });

  it('returns 0 for an empty string', () => {
    expect(evaluateExpression('')).toBe('0');
  });

  it('returns the original string for an incomplete expression ending with an operator', () => {
    expect(evaluateExpression('5+')).toBe('5+');
  });

  it('returns 0 for division by zero (Infinity)', () => {
    expect(evaluateExpression('1/0')).toBe('0');
  });

  it('handles chained operations', () => {
    expect(evaluateExpression('2+3*4')).toBe('14');
  });
});
