/**
 * Where the admin session lives: sessionStorage, not localStorage. The admin token is the most
 * privileged credential in the system, so it should not outlive the tab it was issued to or be readable
 * from every other admin tab opened later. Storage access can throw (disabled storage, some private
 * modes), which reads as "signed out".
 */
const TOKEN_KEY = 'admin_token';
const EMAIL_KEY = 'admin_email';

export const adminSession = {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /** The signed-in email, but only alongside a token — the token is what the API authenticates. */
  getEmail(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ? sessionStorage.getItem(EMAIL_KEY) : null;
    } catch {
      return null;
    }
  },

  save(token: string, email: string) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EMAIL_KEY, email);
  },

  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EMAIL_KEY);
      // Sessions saved by earlier builds, which kept the token in localStorage.
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
    } catch {
      // Nothing stored that we could reach, so nothing to clear.
    }
  },
};
