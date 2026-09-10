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
    // `email` is REQUIRED alongside a 6-digit code — the code is matched only
    // against that account's pending verification. The emailed link's token
    // carries its own identity and needs none.
    verifyEmail: (
      code: string,
      email?: string | null,
    ): Promise<MutationOutcome<VerifyEmailMutation>> =>
      verifyEmail({ variables: { input: { code, email } } }),
    resendVerificationEmail: (
      email: string,
    ): Promise<MutationOutcome<ResendVerificationEmailMutation>> =>
      resendVerificationEmail({ variables: { input: { email } } }),
  };
}

/** The verify call `useVerifyEmail` returns, for callers that pass it on. */
export type VerifyEmailFn = ReturnType<typeof useVerifyEmail>['verifyEmail'];
