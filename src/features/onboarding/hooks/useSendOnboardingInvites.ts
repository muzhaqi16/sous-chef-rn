import { useInviteToHome } from '#features/onboarding/hooks/useInviteToHome';
import { useAddCollaborator } from '#features/shoppingList/hooks/useAddCollaborator';
import {
  CollaboratorRole,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';

interface SendInvitesTarget {
  homeId?: string | null;
  shoppingListId?: string | null;
  message: string;
}

export interface OnboardingInviteResult {
  /** How many of the addresses the server refused. */
  refusedCount: number;
}

/**
 * Send the first household invitations. Every send RESOLVES, refused or not,
 * so the count is the only signal of how many addresses actually went out.
 */
export function useSendOnboardingInvites() {
  const { inviteToHome } = useInviteToHome();
  const { addCollaborator } = useAddCollaborator();

  const sendInvites = async (
    emails: readonly string[],
    { homeId, shoppingListId, message }: SendInvitesTarget,
  ): Promise<OnboardingInviteResult> => {
    const sends = emails.map(email => {
      // Home membership covers home-linked shopping lists, so a home takes
      // precedence over the standalone list.
      if (homeId) {
        return inviteToHome({
          homeId,
          email,
          role: MembershipRole.Member,
          message,
        });
      }
      if (shoppingListId) {
        return addCollaborator({
          shoppingListId,
          email,
          role: CollaboratorRole.Contributor,
        });
      }
      return null;
    });

    const sent = await Promise.all(sends.filter(send => send !== null));
    return { refusedCount: sent.filter(ok => !ok).length };
  };

  return { sendInvites };
}
