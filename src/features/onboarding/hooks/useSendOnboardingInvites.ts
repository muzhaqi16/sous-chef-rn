import { useInviteToHome } from '#features/onboarding/hooks/useInviteToHome';
import { useAddCollaborator } from '#features/shoppingList/hooks/useAddCollaborator';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
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
 * Send the first household invitations. Both underlying mutations pass an
 * `onError`, so a transport failure RESOLVES like a refusal does and no caller
 * can learn from a rejected promise how many addresses actually went out.
 */
export function useSendOnboardingInvites(onError: (error: Error) => void) {
  const { inviteToHome } = useInviteToHome(onError);
  const { addCollaborator } = useAddCollaborator(onError);

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

    const outcomes = await Promise.all(sends.filter(send => send !== null));
    const refusedCount = outcomes.filter(
      outcome => classifyCreateResult(outcome) === 'rejected',
    ).length;

    return { refusedCount };
  };

  return { sendInvites };
}
