export function getApiErrorCode(error: unknown, fallback = 'REQUEST_FAILED'): string {
  const err = error as {
    response?: { data?: { errorCode?: unknown; ErrorCode?: unknown; message?: unknown } };
    errorCode?: unknown;
    message?: unknown;
  };

  const code = err?.response?.data?.errorCode ?? err?.response?.data?.ErrorCode ?? err?.errorCode;
  if (typeof code === 'string' && code.trim()) return code.trim();

  const message = err?.response?.data?.message ?? err?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();

  return fallback;
}
