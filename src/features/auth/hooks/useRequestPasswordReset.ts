import { useMutation } from '@apollo/client/react';
import {
  RequestPasswordResetDocument,
  type RequestPasswordResetMutation,
} from '#operations/auth/auth.generated';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Ask the server to email a reset link. The screen reads the resolved result —
 * under `errorPolicy: 'all'` a refusal RESOLVES rather than throwing.
 */
export function useRequestPasswordReset() {
  const [requestPasswordReset] = useMutation(RequestPasswordResetDocument);

  return {
    requestPasswordReset: (
      email: string,
    ): Promise<MutationOutcome<RequestPasswordResetMutation>> =>
      requestPasswordReset({ variables: { input: { email } } }),
  };
}
