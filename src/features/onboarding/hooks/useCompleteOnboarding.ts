import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { completeOnboardingWrite } from '#apollo/pendingWrites/sharedWrites';

/** An absolute set, so a replay lands the same state; onboarding finishes offline. */
export function useCompleteOnboarding(userId: string | undefined) {
  const { t } = useTranslation();
  const onboard = useLocalWrite(completeOnboardingWrite, {
    fallback: t('onBoarding.completeOnboardingError'),
  });

  return {
    /** True when onboarding completed or is queued to. */
    completeOnboarding: async (): Promise<boolean> => {
      const settled = await onboard.send(
        {},
        {
          entity: userId ? { __typename: 'User', id: userId } : undefined,
          fields: { onBoarded: true },
        },
      );
      return settled.status !== 'failed';
    },
  };
}
