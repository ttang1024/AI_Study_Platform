// Moved to the shared package (packages/core) — the registry and URL heuristics
// were byte-identical between web/ and rn/. Re-exported so existing imports keep
// working unchanged.
export * from '@core/podcastSources';
