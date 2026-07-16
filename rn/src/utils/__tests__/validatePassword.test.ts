import { validatePassword } from '@/utils/validatePassword';

// 8-20 chars, at least 3 of {uppercase, lowercase, number, symbol}. Must stay in step with the
// server's rule, or users get accepted here and rejected on submit.
describe('validatePassword', () => {
  it('accepts a password with three character classes', () => {
    expect(validatePassword('Passw0rd')).toBe(true); // upper + lower + number
  });

  it('accepts a password with all four classes', () => {
    expect(validatePassword('Passw0rd!')).toBe(true);
  });

  it('rejects a password with only two character classes', () => {
    expect(validatePassword('password1')).toBe(false); // lower + number only
    expect(validatePassword('PASSWORD1')).toBe(false); // upper + number only
  });

  it('rejects anything shorter than 8 characters', () => {
    expect(validatePassword('Pas1!')).toBe(false);
  });

  it('rejects anything longer than 20 characters', () => {
    expect(validatePassword('Passw0rd!Passw0rd!Passw0rd!')).toBe(false);
  });

  it('accepts exactly at the length boundaries', () => {
    expect(validatePassword('Passw0rd')).toBe(true);           // 8
    expect(validatePassword('Passw0rd!Passw0rd!12')).toBe(true); // 20
  });

  it('rejects an empty password', () => {
    expect(validatePassword('')).toBe(false);
  });
});
