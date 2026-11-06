import { skipToken, useQuery } from '@apollo/client/react';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useSelectedHomeId } from '#store/useAppStore';
import { useUpdateHomeFields } from '#features/home/hooks/useUpdateHomeFields';
import { HouseholdGreetingHomeDocument } from './useHouseholdGreeting.generated';
import { useFirstName } from './useFirstName';

/**
 * Who the household question greets, and the home it names: the first name
 * given at sign-up, and the selected home, which only its owner may rename.
 * The home is null until setup has made it and the device has read it.
 */
export function useHouseholdGreeting() {
  const firstName = useFirstName();
  const homeId = useSelectedHomeId();
  const { data, variables, error } = useQuery(
    HouseholdGreetingHomeDocument,
    homeId
      ? { variables: { id: homeId }, fetchPolicy: 'cache-first' }
      : skipToken,
  );
  useApolloErrorLogger(HouseholdGreetingHomeDocument, error);
  const { updateHomeFields } = useUpdateHomeFields(homeId ?? '');

  // `skipToken` keeps the last run's data: it may be another home's.
  const home = homeId && variables.id === homeId ? data?.home ?? null : null;

  return {
    firstName,
    homeName: home?.name ?? null,
    canRename: home?.myMembership?.role === MembershipRole.Owner,
    /** True when the new name landed or is queued; `fallback` is the failure copy. */
    rename: async (name: string, fallback: string): Promise<boolean> =>
      home ? updateHomeFields({ name }, home, fallback) : false,
  };
}
