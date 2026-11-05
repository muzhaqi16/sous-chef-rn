import { skipToken, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { canAlert } from '#domain/dietary';
import type { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import { HomeDietaryNeedsDocument } from '#features/home/hooks/useHomeDietaryNeeds.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { useUser } from '#store/useAppStore';

/** A restriction that screens what is suggested: a diet, an allergen or a food. */
export interface HeldRestriction {
  diet: Diet | null;
  intolerance: Intolerance | null;
  item: { id: string; name: string } | null;
}

const keyOf = ({ diet, intolerance, item }: HeldRestriction): string =>
  diet ?? intolerance ?? `item:${item?.id ?? ''}`;

/**
 * The restrictions a household check honors: the user's own and those a member
 * shares with the home, each once. `complete` is false until both reads have
 * answered, so a caller unsure of the answer can treat restrictions as held.
 */
export function useHeldRestrictions(homeId: string | null | undefined): {
  restrictions: HeldRestriction[];
  complete: boolean;
} {
  const userId = useUser()?.id;
  const own = useQuery(
    GetDietaryProfileDocument,
    userId ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  const shared = useQuery(
    HomeDietaryNeedsDocument,
    homeId ? { variables: { homeId }, fetchPolicy: 'cache-first' } : skipToken,
  );
  useApolloErrorLogger(GetDietaryProfileDocument, own.error);
  useApolloErrorLogger(HomeDietaryNeedsDocument, shared.error);

  // `skipToken` keeps the last run's answer: with no home it is another's.
  const ownRead = userId ? own.data : undefined;
  const sharedRead = homeId ? shared.data : undefined;
  const all = [
    ...(ownRead?.me?.dietaryProfile?.restrictions ?? []),
    ...(sharedRead?.home?.dietaryNeeds ?? []).flatMap(
      member => member.restrictions,
    ),
  ].filter(canAlert);

  const byKey = new Map<string, HeldRestriction>();
  for (const { diet, intolerance, item } of all) {
    const held: HeldRestriction = {
      diet: diet ?? null,
      intolerance: intolerance ?? null,
      item: item ? { id: item.id, name: item.name } : null,
    };
    if (!byKey.has(keyOf(held))) byKey.set(keyOf(held), held);
  }

  return {
    restrictions: [...byKey.values()],
    complete: ownRead !== undefined && (!homeId || sharedRead !== undefined),
  };
}
