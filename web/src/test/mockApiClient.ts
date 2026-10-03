import { vi } from 'vitest';

/**
 * A mock of the shared axios wrapper the per-domain services call.
 *
 * <p>Returns a fresh set of spies per call rather than one shared object, so a suite can never
 * inherit call counts from another. It carries every verb, so a service gaining a method does not
 * need its test's mock widened first.</p>
 *
 * <p>Assign the result before the matching <c>vi.mock('../apiClient', …)</c>: the factory runs
 * lazily, when the service under test is first imported, by which point this has initialised.</p>
 */
export const createMockApiClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});
