/**
 * @fileoverview Unit tests for password hashing and verification.
 * @module server/modules/auth/password.test
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password Utility (scrypt)', () => {
  it('hashes password into scrypt$<saltHex>$<hashHex> format', async () => {
    const plain = 'SecurePassword123!';
    const hashed = await hashPassword(plain);

    expect(typeof hashed).toBe('string');
    const parts = hashed.split('$');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1].length).toBe(32); // 16 bytes in hex = 32 chars
    expect(parts[2].length).toBe(128); // 64 bytes in hex = 128 chars
  });

  it('generates unique salts across multiple hashes of identical plaintext', async () => {
    const plain = 'SecretKey@123';
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);

    expect(hash1).not.toBe(hash2);
  });

  it('verifies correct password returns true', async () => {
    const plain = 'MySuperSecretP@ss';
    const hashed = await hashPassword(plain);

    const isValid = await verifyPassword(plain, hashed);
    expect(isValid).toBe(true);
  });

  it('verifies wrong password returns false', async () => {
    const plain = 'MySuperSecretP@ss';
    const hashed = await hashPassword(plain);

    const isValid = await verifyPassword('WrongPassword', hashed);
    expect(isValid).toBe(false);
  });

  it('handles corrupted or invalid stored hash strings gracefully without throwing', async () => {
    expect(await verifyPassword('password', '')).toBe(false);
    expect(await verifyPassword('password', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('password', 'bcrypt$123$456')).toBe(false);
    expect(await verifyPassword('password', 'scrypt$invalidhex$invalidhex')).toBe(false);
  });
});

