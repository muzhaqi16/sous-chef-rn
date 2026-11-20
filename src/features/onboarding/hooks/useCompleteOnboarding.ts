import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { useLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#/i18n';

/** An absolute set, so a replay lands the same state; onboarding finishes offline. */
export function useCompleteOnboarding(userId: string | undefined) {
  const { t } = useTranslation();
  const onboard = useLocalWrite(CompleteOnboardingDocument, {
    fallback: t('onBoarding.completeOnboardingError'),
  });

  return {
    /** True when onboarding completed or is queued to. */
    completeOnboarding: async (): Promise<boolean> => {
      const settled = await onboard.sendFields({
        entity: userId ? { __typename: 'User', id: userId } : undefined,
        fields: { onBoarded: true },
        variables: {},
      });
      return settled.status !== 'failed';
    },
  };
}
