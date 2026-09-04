import { useMutation, useQuery } from '@apollo/client/react';
import {
  DeleteAccountDocument,
  CanDeleteAccountDocument,
  type DeleteAccountMutation,
} from '#operations/auth/user.generated';
import { handleMutationError } from '#/utils/errorHandlers';

/** The mutation result, or nothing when the transport failed. */
export type DeleteAccountResult =
  | { data?: DeleteAccountMutation | null; error?: unknown }
  | undefined;

/** Whether this account may be deleted, what blocks it, and the delete itself. */
export function useDeleteAccount() {
  const {
    data,
    loading: checkingEligibility,
    error: eligibilityError,
    refetch: refetchEligibility,
  } = useQuery(CanDeleteAccountDocument, { fetchPolicy: 'network-only' });

  const [deleteAccountMutation] = useMutation(DeleteAccountDocument);

  /** Undefined means the transport failed and was already reported. */
  const deleteAccount = async (): Promise<DeleteAccountResult> => {
    let result;
    try {
      result = await deleteAccountMutation();
    } catch (error) {
      handleMutationError(error, { operation: 'Delete Account' });
    }
    return result;
  };

  return {
    canDelete: data?.canDeleteAccount?.canDelete ?? false,
    blockers: data?.canDeleteAccount?.blockers ?? [],
    checkingEligibility,
    eligibilityError,
    refetchEligibility,
    deleteAccount,
  };
}
