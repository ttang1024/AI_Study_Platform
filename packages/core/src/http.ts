/**
 * The single platform seam for shared services. web/ and rn/ each wrap their
 * own axios instance (which differ only in token storage and refresh plumbing)
 * in an adapter implementing this interface, so the service logic below imports
 * no HTTP library, storage, or config — it stays pure and identical for both.
 *
 * The shape is intentionally an axios-response subset: `.data` is the parsed
 * body, and handlers then read `.data.data` for the `BaseResponse<T>` envelope.
 */
export interface HttpResponse<T> {
  data: T;
}

export interface HttpRequestConfig {
  params?: Record<string, unknown> | URLSearchParams;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Request body for methods whose signature has no body slot (DELETE). */
  data?: unknown;
}

export interface HttpClient {
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  put<T = unknown>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  patch<T = unknown>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
}
