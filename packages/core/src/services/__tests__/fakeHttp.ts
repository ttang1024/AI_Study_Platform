import { vi } from 'vitest';
import type { HttpClient } from '../../http';

/**
 * A mock of the platform seam every shared service is built on.
 *
 * <p>Returns a fresh set of spies per call rather than one shared object, so a suite can never
 * inherit call counts from another — the services are stateless, the mocks are not.</p>
 */
export const createFakeHttp = (): HttpClient => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

/**
 * Holds a mocked request open so a test can observe what happens while it is in flight — the
 * services dedupe concurrent GETs, and that can only be exercised before the first one settles.
 *
 * <p>Returns the pending promise to hand to the mock, and the resolver to settle it with.</p>
 */
export function deferredResponse<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
