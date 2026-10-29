import React from 'react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ReceiptFlowExitsProvider } from '#features/receipts/screens/receiptFlowExits';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';
import { useOnboardingNavigation } from '#features/onboarding/screens/useOnboardingNavigation';

/**
 * The receipt scanner's exits inside onboarding: its own review route, the
 * items counted for the summary, and a finished review ends the step.
 */
export function OnboardingReceiptExits({
  children,
}: {
  children: React.ReactNode;
}) {
  const { goBack } = useAppNavigation();
  const { navigateToNextStep, navigateWithinStep } = useOnboardingNavigation();
  const { recordReceiptItems } = useRecordOnboardingProgress();

  return (
    <ReceiptFlowExitsProvider
      actions={{
        toReview: () => navigateWithinStep('OnboardingReceiptReview'),
        close: goBack,
        added: recordReceiptItems,
        finished: () => navigateToNextStep('Receipt'),
      }}
    >
      {children}
    </ReceiptFlowExitsProvider>
  );
}
