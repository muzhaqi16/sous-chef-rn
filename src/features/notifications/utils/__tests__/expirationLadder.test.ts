import { ExpirationNotificationType } from '#/graphql/generated/schemaTypes';
import {
  EXPIRATION_LADDER_RUNGS,
  EXPIRATION_THRESHOLD_DAYS,
} from '../expirationLadder';

/**
 * The API skips a rung whose days exceed the threshold, so a picker offering 2
 * behaves as 1 and 5 as 3. These cases hold the client's offer to what the
 * server can fire.
 */
describe('expiration ladder', () => {
  it('offers each rung once, ascending', () => {
    expect(EXPIRATION_THRESHOLD_DAYS).toEqual([0, 1, 3, 7]);
    expect(new Set(EXPIRATION_THRESHOLD_DAYS).size).toBe(
      EXPIRATION_THRESHOLD_DAYS.length,
    );
  });

  it('keeps the non-ladder types out of the threshold values', () => {
    expect(
      EXPIRATION_LADDER_RUNGS[ExpirationNotificationType.ExpiredReminder],
    ).toBeNull();
    expect(
      EXPIRATION_LADDER_RUNGS[ExpirationNotificationType.WeeklyDigest],
    ).toBeNull();
  });
});
