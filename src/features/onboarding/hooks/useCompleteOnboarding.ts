import { useApolloClient, useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { UseCompleteOnboarding_UserFragmentDoc } from './useCompleteOnboarding.generated';

/**
 * Local-first: `onBoarded` is written to the cached user PERMANENTLY before
 * firing, so onboarding finishes offline; an absolute set, so a replay lands
 * the same state. A refusal is alerted here and reverts the flag.
 */
export function useCompleteOnboarding(userId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [completeOnboarding] = useMutation(CompleteOnboardingDocument, {
    context: { localFirst: true },
  });

  return {
    /** True when onboarding completed or is queued to. */
    completeOnboarding: async (): Promise<boolean> => {
      const updates = { onBoarded: true };
      const entity = userId ? { __typename: 'User', id: userId } : undefined;
      return updateEntityFieldsLocalFirst({
        cache: client.cache,
        entity,
        updates,
        // Omits the key when the cached user never carried it, so a refusal
        // leaves the field alone rather than writing `false` over it.
        previous: snapshotFields(
          entity &&
            client.cache.readFragment({
              id: client.cache.identify(entity),
              fragment: UseCompleteOnboarding_UserFragmentDoc,
              optimistic: true,
            }),
          updates,
        ),
        settle: () =>
          settleMutation(() => completeOnboarding(), {
            document: CompleteOnboardingDocument,
            fallback: t('onBoarding.completeOnboardingError'),
          }),
      });
    },
  };
}
