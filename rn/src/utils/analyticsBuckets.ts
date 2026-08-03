// Bucketing logic lives in the shared package (packages/core/src/utils/analyticsBuckets.ts) so
// this app and web's AnalyticsSection group their charts identically. Only the axis-label style
// is ours: RN has room for "Aug 2" where web's denser bar grid uses "8/2".
import {
  bucketAccuracy as bucketAccuracyCore,
  bucketMinutes as bucketMinutesCore,
  shortDayLabel,
} from '@core/utils/analyticsBuckets';

export type { ChartBucket } from '@core/utils/analyticsBuckets';

export const bucketMinutes = (daily: { date: string; totalMinutes: number }[], days: number) =>
  bucketMinutesCore(daily, days, shortDayLabel);

export const bucketAccuracy = (
  daily: { date: string; totalAttempts: number; correctAttempts: number }[],
  days: number,
) => bucketAccuracyCore(daily, days, shortDayLabel);
