import { useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
  type VerifyEmailMutation,
  type ResendVerificationEmailMutation,
} from '#operations/auth/auth.generated';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Spend a verification code, and ask for a fresh one. Both callers read the
 * resolved result — under `errorPolicy: 'all'` a refusal RESOLVES rather than
 * throwing, and "already verified" arrives on whichever channel the API used.
 */
export function useVerifyEmail() {
  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );

  return {
    verifyEmail: (
      code: string,
    ): Promise<MutationOutcome<VerifyEmailMutation>> =>
      verifyEmail({ variables: { input: { code } } }),
    resendVerificationEmail: (
      email: string,
    ): Promise<MutationOutcome<ResendVerificationEmailMutation>> =>
      resendVerificationEmail({ variables: { input: { email } } }),
  };
}

/** The verify call `useVerifyEmail` returns, for callers that pass it on. */
export type VerifyEmailFn = ReturnType<typeof useVerifyEmail>['verifyEmail'];
