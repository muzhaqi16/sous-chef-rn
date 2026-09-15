import { useMutation, useQuery } from '@apollo/client/react';
import {
  DeleteAccountDocument,
  CanDeleteAccountDocument,
} from '#operations/auth/user.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { localizedErrorMessage } from '#/services/errorService';

/** Whether this account may be deleted, what blocks it, and the delete itself. */
export function useDeleteAccount() {
  const { t } = useTranslation();
  const {
    data,
    loading: checkingEligibility,
    error: eligibilityError,
    refetch: refetchEligibility,
  } = useQuery(CanDeleteAccountDocument, { fetchPolicy: 'network-only' });

  const [deleteAccountMutation] = useMutation(DeleteAccountDocument);

  /** True only once the server confirms the account is gone; a failure is alerted. */
  const deleteAccount = async (): Promise<boolean> => {
    const settled = await settleMutation(() => deleteAccountMutation(), {
      document: DeleteAccountDocument,
      fallback: t('account.deleteGenericError'),
    });
    return settled.status === 'applied';
  };

  return {
    canDelete: data?.canDeleteAccount?.canDelete ?? false,
    blockers: data?.canDeleteAccount?.blockers ?? [],
    checkingEligibility,
    eligibilityErrorMessage: eligibilityError
      ? localizedErrorMessage(eligibilityError, t('account.deleteGenericError'))
      : null,
    refetchEligibility,
    deleteAccount,
  };
}
