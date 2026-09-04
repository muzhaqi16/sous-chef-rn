import { useMutation } from '@apollo/client/react';
import {
  ResetPasswordDocument,
  ValidatePasswordResetTokenDocument,
  type ResetPasswordMutation,
  type ValidatePasswordResetTokenMutation,
} from '#operations/auth/auth.generated';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

/**
 * Validate a reset link, then spend it. Both callers read the resolved result —
 * under `errorPolicy: 'all'` a refusal RESOLVES rather than throwing, and an
 * unreachable server is not proof the link is bad.
 */
export function useResetPassword() {
  const [resetPassword] = useMutation(ResetPasswordDocument);
  const [validateToken] = useMutation(ValidatePasswordResetTokenDocument);

  return {
    resetPassword: (
      token: string,
      newPassword: string,
    ): Promise<MutationOutcome<ResetPasswordMutation>> =>
      resetPassword({ variables: { input: { token, newPassword } } }),
    validateToken: (
      token: string,
    ): Promise<MutationOutcome<ValidatePasswordResetTokenMutation>> =>
      validateToken({ variables: { input: { token } } }),
  };
}

/** The reset call `useResetPassword` returns, for callers that pass it on. */
export type ResetPasswordFn = ReturnType<
  typeof useResetPassword
>['resetPassword'];
