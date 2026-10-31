import { useApolloClient, useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { useTranslation } from '#/i18n';

/** An absolute set, so a replay lands the same state; onboarding finishes offline. */
export function useCompleteOnboarding(userId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [completeOnboarding] = useMutation(CompleteOnboardingDocument, {
    context: { localFirst: true },
  });

  return {
    /** True when onboarding completed or is queued to. */
    completeOnboarding: async (): Promise<boolean> => {
      const settled = await sendFields(client.cache, {
        entity: userId ? { __typename: 'User', id: userId } : undefined,
        fields: { onBoarded: true },
        variables: {},
        mutate: completeOnboarding,
        settle: {
          document: CompleteOnboardingDocument,
          fallback: t('onBoarding.completeOnboardingError'),
        },
      });
      return settled.status !== 'failed';
    },
  };
}
