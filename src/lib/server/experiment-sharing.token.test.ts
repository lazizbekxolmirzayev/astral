import { nanoid } from 'nanoid';
import { describe, expect, it } from 'vitest';

// The share-token format check must accept the tokens the API really issues.
const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

describe('share token format', () => {
  it('accepts nanoid(22) tokens', () => {
    for (let i = 0; i < 200; i++) expect(nanoid(22)).toMatch(SHARE_TOKEN);
  });
  it('rejects malformed tokens', () => {
    for (const bad of ['', 'short', 'a'.repeat(64), '$ne', '{"$gt":""}']) expect(bad).not.toMatch(SHARE_TOKEN);
  });
});
