import { useMutation } from '@apollo/client/react';
import { ChangePasswordDocument } from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

/**
 * What the server did. `body` is localized copy, and `field` names the input a
 * refusal was about, so the caller can put it on that field.
 */
export type ChangePasswordOutcome =
  | { status: 'completed' }
  | { status: 'refused'; field: string | null; body: string };

/**
 * Change the signed-in account's password. `changePassword` is capped at
 * 5/hour and a wrong current password is NOT refunded, so the limit arrives as
 * a transport error whose copy names the wait.
 */
export function useChangePassword() {
  const { t } = useTranslation();
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
    if (
      appliedPayload(settled.data)?.status === PasswordActionStatus.Completed
    ) {
      return { status: 'completed' };
    }
    return { status: 'refused', field: null, body: t('changePassword.failed') };
  };

  return { changePassword: submit };
}
