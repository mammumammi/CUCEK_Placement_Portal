import { describe, it, expect } from 'vitest';
import { calculateCreditBasedCgpa } from './cgpa.service';

describe('calculateCreditBasedCgpa', () => {
  it('weights each SGPA by its credits', () => {
    expect(calculateCreditBasedCgpa([{ credits: 20, sgpa: 8 }, { credits: 22, sgpa: 9 }])).toBe(8.52); // (160+198)/42
  });
  it('is not a simple average', () => {
    expect(calculateCreditBasedCgpa([{ credits: 20, sgpa: 8 }, { credits: 22, sgpa: 9 }])).not.toBe(8.5);
  });
  it('equals the SGPA for one semester', () => {
    expect(calculateCreditBasedCgpa([{ credits: 24, sgpa: 8.4 }])).toBe(8.4);
  });
  it('rounds to 2 decimals', () => {
    expect(calculateCreditBasedCgpa([{ credits: 3, sgpa: 7.777 }])).toBe(7.78);
  });
  it('returns 0 for no semesters or zero credits', () => {
    expect(calculateCreditBasedCgpa([])).toBe(0);
    expect(calculateCreditBasedCgpa([{ credits: 0, sgpa: 9 }])).toBe(0);
  });
  it('rejects invalid input', () => {
    expect(() => calculateCreditBasedCgpa([{ credits: 20, sgpa: 11 }])).toThrow();
    expect(() => calculateCreditBasedCgpa([{ credits: -1, sgpa: 8 }])).toThrow();
  });
});

