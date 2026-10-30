/**
 * @fileoverview Password hashing and verification using asynchronous scrypt.
 * @module server/modules/auth/password
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64; // 64 bytes hash (128 hex characters)
const SALT_LENGTH = 16; // 16 bytes salt (32 hex characters)
const HEX_REGEX = /^[0-9a-fA-F]+$/;

/**
 * Hashes a plaintext password asynchronously using Node.js crypto.scrypt.
 *
 * @param plain - The plaintext password to hash.
 * @returns Serialized string in the format "scrypt$<saltHex>$<hashHex>".
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timingSafeEqual.
 *
 * @param plain - The plaintext password to evaluate.
 * @param stored - Stored hash string in "scrypt$<saltHex>$<hashHex>" format.
 * @returns True if password matches, false otherwise.
 */
export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  if (!stored || typeof stored !== 'string') {
    return false;
  }

  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, saltHex, hashHex] = parts;
  if (
    !saltHex ||
    !hashHex ||
    saltHex.length !== SALT_LENGTH * 2 ||
    hashHex.length !== KEY_LENGTH * 2 ||
    !HEX_REGEX.test(saltHex) ||
    !HEX_REGEX.test(hashHex)
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');

    const derivedKey = (await scryptAsync(
      plain,
      salt,
      expectedHash.length
    )) as Buffer;

    if (derivedKey.length !== expectedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedHash);
  } catch {
    return false;
  }
}
