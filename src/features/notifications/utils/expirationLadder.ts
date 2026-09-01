import { ExpirationNotificationType } from '#/graphql/generated/schemaTypes';

/**
 * Days before expiry that each rung of the API's expiration ladder fires. The
 * API skips a rung whose days exceed `expirationDaysThreshold`, so a threshold
 * BETWEEN two rungs silently behaves as the rung below it — offering 5 gives
 * the same notifications as 3, under a label that never comes true.
 */
export const EXPIRATION_LADDER_RUNGS: Partial<
  Record<ExpirationNotificationType, number>
> = {
  [ExpirationNotificationType.ExpiresToday]: 0,
  [ExpirationNotificationType.ExpiresTomorrow]: 1,
  [ExpirationNotificationType.ExpiresIn_3Days]: 3,
  [ExpirationNotificationType.ExpiresIn_7Days]: 7,
};

/** Expiration types that carry no "days before", so they set no threshold. */
export const NON_LADDER_TYPES: readonly ExpirationNotificationType[] = [
  ExpirationNotificationType.ExpiredReminder,
  ExpirationNotificationType.WeeklyDigest,
];

/** The only threshold values the API can act on, ascending. */
export const EXPIRATION_THRESHOLD_DAYS: readonly number[] = Object.values(
  EXPIRATION_LADDER_RUNGS,
)
  .filter((days): days is number => days !== undefined)
  .sort((a, b) => a - b);
