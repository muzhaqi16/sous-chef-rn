import { useMutation } from '@apollo/client/react';
import {
  ResetPasswordDocument,
  ValidatePasswordResetTokenDocument,
} from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

/**
 * What the reset did. `linkRejected`: the token is spent or bad, which the
 * server reports as a status on the success payload. `field` names the input a
 * refusal was about; `body` is localized copy.
 */
export type ResetPasswordOutcome =
  | { status: 'completed' }
  | { status: 'linkRejected' }
  | { status: 'refused'; field: string | null; body: string };

/**
 * Validate a reset link, then spend it. Nothing here throws, and an unreachable
 * server is not proof the link is good.
 */
export function useResetPassword() {
  const { t } = useTranslation();
  const [resetPassword] = useMutation(ResetPasswordDocument);
  const [validateToken] = useMutation(ValidatePasswordResetTokenDocument);

  return {
    resetPassword: async (
      token: string,
      newPassword: string,
    ): Promise<ResetPasswordOutcome> => {
      // `resetPassword` is capped at 5/hour, and the limit's copy names the wait.
      const settled = await settleMutation(
        () => resetPassword({ variables: { input: { token, newPassword } } }),
        {
          document: ResetPasswordDocument,
          fallback: t('auth.resetPasswordFailedFallback'),
          present: 'none',
        },
      );
      if (settled.failure) {
        return {
          status: 'refused',
          field: settled.failure.field,
          body: settled.failure.body,
        };
      }
      const payload = appliedPayload(settled.data);
      if (payload?.status === PasswordActionStatus.Completed) {
        return { status: 'completed' };
      }
      if (payload?.status === PasswordActionStatus.InvalidOrExpired) {
        return { status: 'linkRejected' };
      }
      return {
        status: 'refused',
        field: null,
        body: t('errors.resetPasswordFailed'),
      };
    },
    /** True only when the server accepted the token. */
    validateToken: async (token: string): Promise<boolean> => {
      const settled = await settleMutation(
        () => validateToken({ variables: { input: { token } } }),
        {
          document: ValidatePasswordResetTokenDocument,
          fallback: t('auth.invalidResetToken'),
          present: 'none',
        },
      );
      const payload = appliedPayload(settled.data);
      return (
        !!payload && payload.status !== PasswordActionStatus.InvalidOrExpired
      );
    },
  };
}

/** The reset call `useResetPassword` returns, for callers that pass it on. */
export type ResetPasswordFn = ReturnType<
  typeof useResetPassword
>['resetPassword'];
