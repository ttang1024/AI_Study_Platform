import { describe, expect, it, vi } from 'vitest';
import { createRequestCache } from '../requestCache';
import { deferredResponse } from '../services/__tests__/fakeHttp';

describe('createRequestCache', () => {
  it('joins an in-flight request for the same key', async () => {
    const cache = createRequestCache<number>();
    const inFlight = deferredResponse<number>();
    const load = vi.fn(() => inFlight.promise);

    const a = cache.get('k', load);
    const b = cache.get('k', load);
    inFlight.resolve(1);

    expect(await a).toBe(1);
    expect(await b).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('without a TTL, re-fetches once the request settles', async () => {
    const cache = createRequestCache<number>();
    const load = vi.fn(async () => 1);

    await cache.get('k', load);
    await cache.get('k', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('with a TTL, serves the settled value until cleared', async () => {
    const cache = createRequestCache<number>(60_000);
    const load = vi.fn(async () => 1);

    await cache.get('k', load);
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(1);

    cache.clear();
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not let a request that straddles clear() repopulate the cache', async () => {
    const cache = createRequestCache<number>(60_000);
    const stale = deferredResponse<number>();

    const before = cache.get('k', () => stale.promise);
    cache.clear();
    stale.resolve(1);
    expect(await before).toBe(1);

    const load = vi.fn(async () => 2);
    expect(await cache.get('k', load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a request settling after clear() does not evict the newer in-flight one', async () => {
    const cache = createRequestCache<number>();
    const stale = deferredResponse<number>();
    const fresh = deferredResponse<number>();

    const before = cache.get('k', () => stale.promise);
    cache.clear();
    const after = cache.get('k', () => fresh.promise);
    stale.resolve(1);
    await before;

    const load = vi.fn(() => fresh.promise);
    const joined = cache.get('k', load);
    fresh.resolve(2);

    expect(await after).toBe(2);
    expect(await joined).toBe(2);
    expect(load).not.toHaveBeenCalled();
  });

  it('does not cache a failed request', async () => {
    const cache = createRequestCache<number>(60_000);
    await expect(cache.get('k', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await cache.get('k', async () => 3)).toBe(3);
  });
});
