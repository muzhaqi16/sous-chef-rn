import { useApolloClient, useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { gql } from '@apollo/client';
import { useTranslation } from '#/i18n';

/** The one field the revert has to be able to read back. */
const ONBOARDED_FRAGMENT = gql`
  fragment _OnboardedFlag on User {
    onBoarded
  }
`;

/**
 * Local-first: `onBoarded` is written to the cached user PERMANENTLY before
 * firing, so onboarding finishes with no network. An absolute set on the
 * caller's own row, so a replay lands the same state. A refusal is alerted
 * here and reverts the flag.
 */
export function useCompleteOnboarding(userId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [completeOnboarding] = useMutation(CompleteOnboardingDocument);

  return {
    /** True when onboarding completed or is queued to. */
    completeOnboarding: async (): Promise<boolean> => {
      const updates = { onBoarded: true };
      const entity = userId ? { __typename: 'User', id: userId } : undefined;
      const { persisted } = await updateEntityFieldsLocalFirst({
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
        mutate: async () => {
          const settled = await settleMutation(
            () => completeOnboarding({ context: { localFirst: true } }),
            {
              document: CompleteOnboardingDocument,
              fallback: t('onBoarding.completeOnboardingError'),
            },
          );
          // The settled failure stands in for the error, so the revert runs
          // exactly when a failure was presented.
          return { data: settled.data, error: settled.failure };
        },
      });
      return persisted;
    },
  };
}
