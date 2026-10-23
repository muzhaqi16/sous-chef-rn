import { useMutation } from '@apollo/client/react';
import { ChangePasswordDocument } from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { authService } from '#/services/authService';
import { useUserId } from '#store/useAppStore';

/**
 * What the server did. `body` is localized copy, and `field` names the input a
 * refusal was about, so the caller can put it on that field. `staysSignedIn`
 * is false when no new session came back: the next request then ends this one.
 * `storedSignInDropped`: the biometric sign-in could not be renewed and is off.
 */
export type ChangePasswordOutcome =
  | {
      status: 'completed';
      staysSignedIn: boolean;
      storedSignInDropped: boolean;
    }
  | { status: 'refused'; field: string | null; body: string };

/**
 * Change the signed-in account's password. `changePassword` is capped at
 * 5/hour and a wrong current password is NOT refunded, so the limit arrives as
 * a transport error whose copy names the wait.
 */
export function useChangePassword() {
  const { t } = useTranslation();
  const userId = useUserId();
  const [changePassword] = useMutation(ChangePasswordDocument);

  const submit = async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ChangePasswordOutcome> => {
    const settled = await settleMutation(
      () => changePassword({ variables: { input } }),
      {
        document: ChangePasswordDocument,
        fallback: t('changePassword.failed'),
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
    if (payload?.status !== PasswordActionStatus.Completed) {
      return {
        status: 'refused',
        field: null,
        body: t('changePassword.failed'),
      };
    }
    if (!payload.session || !userId) {
      return {
        status: 'completed',
        staysSignedIn: false,
        storedSignInDropped: false,
      };
    }

    // Awaited: renewing the biometric sign-in can raise the system prompt, and
    // the screen must not move on beneath it.
    const renewal = await authService.adoptPasswordChangeSession(
      payload.session,
      userId,
    );
    return {
      status: 'completed',
      staysSignedIn: renewal !== 'discarded',
      storedSignInDropped: renewal === 'dropped',
    };
  };

  return { changePassword: submit };
}
