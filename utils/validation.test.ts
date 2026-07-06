import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidAmount } from './validation';

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.org')).toBe(true);
  });

  it('rejects an address with no @', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('rejects an address with nothing before @', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects an address with no domain part', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects an address with no TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidAmount', () => {
  describe('numeric input', () => {
    it('accepts a positive number', () => {
      expect(isValidAmount(5)).toBe(true);
      expect(isValidAmount(0.01)).toBe(true);
    });

    it('rejects zero', () => {
      expect(isValidAmount(0)).toBe(false);
    });

    it('rejects a negative number', () => {
      expect(isValidAmount(-5)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(isValidAmount(NaN)).toBe(false);
    });
  });

  describe('string input', () => {
    it('accepts a positive numeric string', () => {
      expect(isValidAmount('50')).toBe(true);
      expect(isValidAmount('0.01')).toBe(true);
    });

    it('accepts a string expression that evaluates to a positive number', () => {
      expect(isValidAmount('1+2')).toBe(true);
      expect(isValidAmount('10/2')).toBe(true);
    });

    it('rejects a string that evaluates to zero', () => {
      expect(isValidAmount('0')).toBe(false);
    });

    it('rejects a string that evaluates to a negative result', () => {
      expect(isValidAmount('-5')).toBe(false);
    });

    it('rejects a non-numeric string', () => {
      expect(isValidAmount('abc')).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isValidAmount('')).toBe(false);
    });

    it('rejects an incomplete expression ending with an operator', () => {
      expect(isValidAmount('5+')).toBe(false);
    });
  });
});
