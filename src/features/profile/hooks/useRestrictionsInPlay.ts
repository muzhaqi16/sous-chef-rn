import { skipToken, useQuery } from '@apollo/client/react';
import { canAlert } from '#domain/dietary';
import { HomeDietaryNeedsDocument } from '#features/home/hooks/useHomeDietaryNeeds.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { useUser } from '#store/useAppStore';

/**
 * Whether a household check has a restriction it could flag: the user's own,
 * or one a member shares with the home. Null until both reads have answered,
 * so a caller unsure of the answer treats restrictions as in play.
 */
export function useRestrictionsInPlay(
  homeId: string | null | undefined,
): boolean | null {
  const userId = useUser()?.id;
  const own = useQuery(
    GetDietaryProfileDocument,
    userId ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  const shared = useQuery(
    HomeDietaryNeedsDocument,
    homeId ? { variables: { homeId }, fetchPolicy: 'cache-first' } : skipToken,
  );

  // `skipToken` keeps the last run's answer: with no home it is another's.
  const ownRead = userId ? own.data : undefined;
  const sharedRead = homeId ? shared.data : undefined;
  const ownAlerts = (ownRead?.me?.dietaryProfile?.restrictions ?? []).some(
    canAlert,
  );
  const sharedAlerts = (sharedRead?.home?.dietaryNeeds ?? []).some(member =>
    member.restrictions.some(canAlert),
  );

  if (ownAlerts || sharedAlerts) return true;
  const ownAnswered = ownRead !== undefined;
  const sharedAnswered = !homeId || sharedRead !== undefined;
  return ownAnswered && sharedAnswered ? false : null;
}
