import { ExpirationNotificationType } from '#/graphql/generated/schemaTypes';
import {
  EXPIRATION_LADDER_RUNGS,
  EXPIRATION_THRESHOLD_DAYS,
  NON_LADDER_TYPES,
} from '../expirationLadder';

/**
 * `expirationDaysThreshold` was stored but never read for months, so the picker
 * drifted to offering 2 and 5 — values the ladder cannot express. The API skips
 * a rung whose days exceed the threshold, which makes 2 behave as 1 and 5 as 3.
 * These cases hold the client's offer to what the server can fire.
 */
describe('expiration ladder', () => {
  it('classifies every expiration type the schema declares', () => {
    const classified = new Set<string>([
      ...Object.keys(EXPIRATION_LADDER_RUNGS),
      ...NON_LADDER_TYPES,
    ]);

    const unclassified = Object.values(ExpirationNotificationType).filter(
      type => !classified.has(type),
    );

    // A new rung on the API side lands here until the picker offers it.
    expect(unclassified).toEqual([]);
  });

  it('offers each rung once, ascending', () => {
    expect(EXPIRATION_THRESHOLD_DAYS).toEqual([0, 1, 3, 7]);
    expect(new Set(EXPIRATION_THRESHOLD_DAYS).size).toBe(
      EXPIRATION_THRESHOLD_DAYS.length,
    );
  });

  it('keeps the non-ladder types out of the threshold values', () => {
    NON_LADDER_TYPES.forEach(type => {
      expect(EXPIRATION_LADDER_RUNGS[type]).toBeUndefined();
    });
  });
});
