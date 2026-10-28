import { describe, expect, it } from 'vitest';
import { jwtExpiresWithin } from '../jwt';

const token = (claims: object) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('jwtExpiresWithin', () => {
  const now = 1_700_000_000_000;

  it('is false for a token with time to spare', () => {
    expect(jwtExpiresWithin(token({ exp: now / 1000 + 600 }), 30, now)).toBe(false);
  });

  it('is true inside the margin and once expired', () => {
    expect(jwtExpiresWithin(token({ exp: now / 1000 + 10 }), 30, now)).toBe(true);
    expect(jwtExpiresWithin(token({ exp: now / 1000 - 1 }), 30, now)).toBe(true);
  });

  it('treats an unreadable token as expiring', () => {
    expect(jwtExpiresWithin('not-a-jwt', 30, now)).toBe(true);
    expect(jwtExpiresWithin(token({ sub: 'x' }), 30, now)).toBe(true);
  });
});
