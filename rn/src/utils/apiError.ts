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

export function getApiErrorMessage(error: unknown, fallback = 'Request failed.'): string {
  const err = error as {
    response?: { data?: { message?: unknown; errors?: unknown } };
    message?: unknown;
  };

  const message = err?.response?.data?.message ?? err?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();

  const errors = err?.response?.data?.errors;
  if (Array.isArray(errors)) {
    const first = errors.find((item) => typeof item === 'string' && item.trim());
    if (typeof first === 'string') return first.trim();
  }

  return fallback;
}
