import argon2 from 'argon2';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function isPasswordLengthValid(password: string): boolean {
  const length = Array.from(password).length;
  return length >= MIN_PASSWORD_LENGTH && length <= MAX_PASSWORD_LENGTH;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
