// Moved to the shared package (packages/core). Kept as a re-export so existing
// `@/utils/achievements` imports across rn/ keep working unchanged. Conditions
// take `AchievementProgress`, a structural subset of `UserStats` — screens pass
// their loaded UserStats straight in.
export * from '@core/achievements';
