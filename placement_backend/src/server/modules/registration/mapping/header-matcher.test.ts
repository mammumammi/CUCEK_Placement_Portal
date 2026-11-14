import { describe, it, expect } from 'vitest';
import { normalizeHeader, suggestMappingDeterministic } from './header-matcher';

describe('normalizeHeader', () => {
  it('lowercases, trims and strips punctuation', () => {
    expect(normalizeHeader('  Student  ID. ')).toBe('student id');
    expect(normalizeHeader('E-Mail')).toBe('e mail');
  });
});

describe('suggestMappingDeterministic', () => {
  it('maps common variants to canonical fields', () => {
    const { mapping } = suggestMappingDeterministic([
      'Student ID',
      'Reg No',
      'Full Name',
      'First Name',
      'Last Name',
      'Date of Birth',
      'Age',
      'Dept',
      'Mail Id',
      'Mobile',
    ]);
    expect(mapping['Student ID'].field).toBe('studentId');
    expect(mapping['Reg No'].field).toBe('registrationNumber');
    expect(mapping['Full Name'].field).toBe('name');
    expect(mapping['First Name'].field).toBe('firstName');
    expect(mapping['Last Name'].field).toBe('lastName');
    expect(mapping['Date of Birth'].field).toBe('dob');
    expect(mapping['Age'].field).toBe('age');
    expect(mapping['Dept'].field).toBe('branch');
    expect(mapping['Mail Id'].field).toBe('email');
    expect(mapping['Mobile'].field).toBe('phone');
  });
  it('maps semester columns by pattern', () => {
    const { mapping } = suggestMappingDeterministic(['Sem 1 SGPA', 'S2', 'Credits Sem 3', 'SGPA S4']);
    expect(mapping['Sem 1 SGPA'].field).toBe('s1Sgpa');
    expect(mapping['Credits Sem 3'].field).toBe('s3Credits');
    expect(mapping['SGPA S4'].field).toBe('s4Sgpa');
  });
  it('returns unrecognised headers as unmatched', () => {
    const { unmatched } = suggestMappingDeterministic(['Reg No', 'Favourite Colour']);
    expect(unmatched).toContain('Favourite Colour');
  });
  it('assigns each field to only one header', () => {
    const { mapping } = suggestMappingDeterministic(['Student ID', 'Roll No']);
    const mapped = Object.values(mapping).filter(m => m.field === 'studentId');
    expect(mapped).toHaveLength(1);
  });
});

