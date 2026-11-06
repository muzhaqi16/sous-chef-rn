import { useHeldRestrictions } from './useHeldRestrictions';

/**
 * Whether a household check has a restriction it could flag: the user's own,
 * or one a member shares with the home. Null until both reads have answered,
 * so a caller unsure of the answer treats restrictions as in play.
 */
export function useRestrictionsInPlay(
  homeId: string | null | undefined,
): boolean | null {
  const { restrictions, complete } = useHeldRestrictions(homeId);
  if (restrictions.length > 0) return true;
  return complete ? false : null;
}
