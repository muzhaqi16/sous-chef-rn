import { skipToken, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import { useUser } from '#store/useAppStore';

/** How many people the user cooks for, from their profile; null when not answered. */
export function useCooksFor(): number | null {
  const userId = useUser()?.id;
  const { data, error } = useQuery(
    GetDietaryProfileDocument,
    userId ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  useApolloErrorLogger(GetDietaryProfileDocument, error);
  return data?.me?.dietaryProfile?.cooksFor ?? null;
}
