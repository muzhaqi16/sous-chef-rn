import { useMutation } from '@apollo/client/react';
import {
  ChangePasswordDocument,
  type ChangePasswordMutation,
} from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';

type ChangePasswordResult = ChangePasswordMutation['changePassword'];

/** What the server did. The caller turns a refusal into copy on the field. */
export type ChangePasswordOutcome =
  | { status: 'completed' }
  /** Already localized: the wait time comes from the transport error itself. */
  | { status: 'rateLimited'; localizedMessage: string }
  | { status: 'refused'; payload: ChangePasswordResult | undefined };

/**
 * Change the signed-in account's password. Rate limiting is separated out
 * because `changePassword` is capped at 5/hour and a wrong current password is
 * NOT refunded, so the budget goes in one sitting — and the limit arrives as a
 * transport error rather than a payload member.
 */
export function useChangePassword() {
  const [changePassword] = useMutation(ChangePasswordDocument);

  const submit = async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ChangePasswordOutcome> => {
    const result = await changePassword({ variables: { input } });

    if (isRateLimitError(result.error)) {
      return {
        status: 'rateLimited',
        localizedMessage: getRateLimitMessage(result.error),
      };
    }

    const payload = result.data?.changePassword;
    if (
      payload?.__typename === 'ChangePasswordPayload' &&
      payload.status === PasswordActionStatus.Completed
    ) {
      return { status: 'completed' };
    }
    return { status: 'refused', payload };
  };

  return { changePassword: submit };
}
