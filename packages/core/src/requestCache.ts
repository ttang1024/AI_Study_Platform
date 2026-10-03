/**
 * Per-key request coalescing with an optional TTL — the one implementation behind
 * every service that collapses the identical concurrent fetches a page and a
 * deferred context load both fire on mount.
 *
 * - A fresh cached value (younger than `ttlMs`) is returned without a request.
 * - A caller arriving while a request for the same key is in flight joins it.
 * - `clear()` drops both, and a request that was already in flight when it ran
 *   settles for its own callers but is never written back — so a mutation (or a
 *   sign-out) can't be undone by a stale response landing after it.
 *
 * `ttlMs = 0` (the default) is in-flight dedupe only: nothing is cached.
 */
export interface RequestCache<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createRequestCache<T>(ttlMs = 0): RequestCache<T> {
  const inflight = new Map<string, Promise<T>>();
  const cache = new Map<string, { value: T; expiresAt: number }>();
  let generation = 0;

  return {
    get(key, load) {
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

      const pending = inflight.get(key);
      if (pending) return pending;

      const startedIn = generation;
      const request = load()
        .then(value => {
          if (ttlMs > 0 && startedIn === generation)
            cache.set(key, { value, expiresAt: Date.now() + ttlMs });
          return value;
        })
        .finally(() => {
          if (inflight.get(key) === request) inflight.delete(key);
        });

      inflight.set(key, request);
      return request;
    },

    clear() {
      generation++;
      cache.clear();
      inflight.clear();
    },
  };
}
