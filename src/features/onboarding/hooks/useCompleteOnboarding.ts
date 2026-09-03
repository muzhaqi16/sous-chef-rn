import { useMutation } from '@apollo/client/react';
import {
  CompleteOnboardingDocument,
  type CompleteOnboardingMutation,
} from '#operations/auth/user.generated';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Mark the account onboarded. The screen reads the resolved result — under
 * `errorPolicy: 'all'` a refusal RESOLVES rather than throwing.
 */
export function useCompleteOnboarding() {
  const [completeOnboarding] = useMutation(CompleteOnboardingDocument);

  return {
    completeOnboarding: (): Promise<
      MutationOutcome<CompleteOnboardingMutation>
    > => completeOnboarding(),
  };
}
