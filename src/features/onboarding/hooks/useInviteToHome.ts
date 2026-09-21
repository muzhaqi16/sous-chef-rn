import { useMutation } from '@apollo/client/react';
import { InviteToHomeDocument } from '#operations/home/home.generated';
import type { InviteToHomeInput } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/**
 * Invite someone to a home. Onboarding's own, because it invites the first
 * members before the home feature's screens are reachable.
 */
export function useInviteToHome() {
  const { t } = useTranslation();
  const [inviteToHome] = useMutation(InviteToHomeDocument);

  return {
    /** False when the server refused the invite or never ruled on it. */
    inviteToHome: async (input: InviteToHomeInput): Promise<boolean> => {
      const settled = await settleMutation(
        () => inviteToHome({ variables: { input } }),
        {
          document: InviteToHomeDocument,
          fallback: t('errors.sendInviteFailed'),
          present: 'none',
        },
      );
      return settled.status !== 'failed';
    },
  };
}
