import { useApolloClient, useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { gql } from '@apollo/client';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/** The one field the revert has to be able to read back. */
const ONBOARDED_FRAGMENT = gql`
  fragment _OnboardedFlag on User {
    onBoarded
  }
`;

/**
 * Local-first: `onBoarded` is written to the cached user PERMANENTLY before
 * firing, so onboarding finishes with no network. An absolute set on the
 * caller's own row, so a replay lands the same state. A refusal RESOLVES under
 * `errorPolicy: 'all'`, which is what the screen reads.
 */
export function useCompleteOnboarding(userId: string | undefined) {
  const client = useApolloClient();
  const [completeOnboarding] = useMutation(CompleteOnboardingDocument);

  return {
    completeOnboarding: async (): Promise<MutationOutcome> => {
      const updates = { onBoarded: true };
      const entity = userId ? { __typename: 'User', id: userId } : undefined;
      const { result } = await updateEntityFieldsLocalFirst({
        cache: client.cache,
        entity,
        updates,
        // Omits the key when the cached user never carried it, so a refusal
        // leaves the field alone rather than writing `false` over it.
        previous: snapshotFields(
          entity &&
            client.cache.readFragment<{ onBoarded: boolean }>({
              id: client.cache.identify(entity),
              fragment: ONBOARDED_FRAGMENT,
            }),
          updates,
        ),
        logLabel: 'Complete Onboarding',
        mutate: () => completeOnboarding({ context: { localFirst: true } }),
      });
      return result ?? {};
    },
  };
}
