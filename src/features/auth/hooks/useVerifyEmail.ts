import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { useUserId } from '#store/useAppStore';
import { SignedInEmailVerificationDocument } from '#features/auth/hooks/useVerifyEmail.generated';

/**
 * `refused`: the server ruled against this code or link, so the reader can act
 * on it. `failed`: it never ruled. `body` is localized copy in both. `userId`
 * is the account verified, which a link need not share with the signed-in one;
 * null when the server named none, and for a code's "already verified".
 */
export type VerifyEmailOutcome =
  | { status: 'verified'; userId: string | null }
  | { status: 'refused'; body: string }
  | { status: 'failed'; body: string };

export type ResendVerificationOutcome =
  | { status: 'sent' }
  | { status: 'alreadyVerified' }
  | { status: 'failed'; body: string };

/**
 * Spend a verification code, and ask for a fresh one. "Already verified" is a
 * success on either call, whichever channel the API reported it on.
 */
export function useVerifyEmail() {
  const { t } = useTranslation();
  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );
  const client = useApolloClient();
  const signedInUserId = useUserId();

  // "Already verified" names no account, and a link can belong to another, so
  // the signed-in account counts as verified only once the server says so.
  const verifiedSignedInUserId = async (): Promise<string | null> => {
    if (!signedInUserId) return null;
    const read = await client
      .query({
        query: SignedInEmailVerificationDocument,
        fetchPolicy: 'network-only',
      })
      .catch(() => null);
    const me = read?.data?.me;
    return me?.id === signedInUserId && me.emailVerified ? me.id : null;
  };

  return {
    // `email` is REQUIRED alongside a 6-digit code — the code is matched only
    // against that account's pending verification. The emailed link's token
    // carries its own identity and needs none. `invalidCopy` is the caller's
    // sentence for a refused code or link.
    verifyEmail: async (
      code: string,
      email?: string | null,
      invalidCopy?: string,
    ): Promise<VerifyEmailOutcome> => {
      const fallback = t('errors.codes.genericRetry');
      const settled = await settleMutation(
        () => verifyEmail({ variables: { input: { code, email } } }),
        {
          document: VerifyEmailDocument,
          fallback,
          present: 'none',
          // The only validation refusal `verifyEmail` returns is a bad code:
          // the server collapses wrong, spent and expired into it.
          copy: invalidCopy
            ? {
                [ErrorCode.ValidationFailed]: {
                  title: t('labels.error'),
                  body: invalidCopy,
                },
              }
            : undefined,
        },
      );

      if (settled.status === 'applied') {
        const verified = appliedPayload(settled.data);
        return { status: 'verified', userId: verified?.user.id ?? null };
      }
      const { failure } = settled;
      if (failure?.code === ErrorCode.EmailAlreadyVerified) {
        // A code is spent against `email`'s account, so only a link re-reads.
        const userId = email ? null : await verifiedSignedInUserId();
        return { status: 'verified', userId };
      }
      const body = failure?.body ?? fallback;
      // A refusal member in `data` is the server's ruling on this code.
      return settled.data?.verifyEmail
        ? { status: 'refused', body }
        : { status: 'failed', body };
    },
    resendVerificationEmail: async (
      email: string,
    ): Promise<ResendVerificationOutcome> => {
      const settled = await settleMutation(
        () => resendVerificationEmail({ variables: { input: { email } } }),
        {
          document: ResendVerificationEmailDocument,
          fallback: t('auth.resendVerificationFailed'),
          present: 'none',
        },
      );
      if (!settled.failure) return { status: 'sent' };
      if (settled.failure.code === ErrorCode.EmailAlreadyVerified) {
        return { status: 'alreadyVerified' };
      }
      return { status: 'failed', body: settled.failure.body };
    },
  };
}

/** The verify call `useVerifyEmail` returns, for callers that pass it on. */
export type VerifyEmailFn = ReturnType<typeof useVerifyEmail>['verifyEmail'];
