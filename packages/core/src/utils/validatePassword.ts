// Client-side mirror of the backend password policy: 8-20 chars, at least 3 of
// {uppercase, lowercase, number, symbol}. Was inlined in web's LoginPage /
// RegisterPage / SecurityTab and duplicated in rn.
export function validatePassword(pass: string): boolean {
  if (pass.length < 8 || pass.length > 20) return false;
  let types = 0;
  if (/[A-Z]/.test(pass)) types++;
  if (/[a-z]/.test(pass)) types++;
  if (/[0-9]/.test(pass)) types++;
  if (/[^A-Za-z0-9]/.test(pass)) types++;
  return types >= 3;
}
