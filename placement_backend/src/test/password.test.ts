import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('never stores the plain password and verifies correctly', async () => {
    const hash = await hashPassword('KTE22CS001');
    expect(hash).not.toContain('KTE22CS001');
    expect(await verifyPassword('KTE22CS001', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
  it('uses a unique salt each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});