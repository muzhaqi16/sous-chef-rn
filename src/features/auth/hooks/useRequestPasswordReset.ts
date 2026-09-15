import { useMutation } from '@apollo/client/react';
import { RequestPasswordResetDocument } from '#operations/auth/auth.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/** Ask the server to email a reset link. */
export function useRequestPasswordReset() {
  const { t } = useTranslation();
  const [requestPasswordReset] = useMutation(RequestPasswordResetDocument);

  return {
    /**
     * Null once the server CONFIRMS the send; otherwise the localized reason it
     * did not. A refusal resolves with no transport error, so absence of a
     * throw is not a send.
     */
    requestPasswordReset: async (email: string): Promise<string | null> => {
      const fallback = t('errors.codes.genericRetry');
      const settled = await settleMutation(
        () => requestPasswordReset({ variables: { input: { email } } }),
        {
          document: RequestPasswordResetDocument,
          fallback,
          present: 'none',
        },
      );
      if (settled.status === 'applied') return null;
      return settled.failure?.body ?? fallback;
    },
  };
}
