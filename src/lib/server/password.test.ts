import { describe, expect, it } from 'vitest';
import { hashPassword, isPasswordLengthValid, verifyPassword } from './password';

describe('password handling', () => {
  it('enforces the inclusive 12-128 character limits', () => {
    expect(isPasswordLengthValid('a'.repeat(11))).toBe(false);
    expect(isPasswordLengthValid('a'.repeat(12))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(128))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(129))).toBe(false);
  });

  it('hashes with Argon2id and checks the submitted password', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'incorrect password')).resolves.toBe(false);
  });
});
