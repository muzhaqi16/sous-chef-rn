import { useMutation } from '@apollo/client/react';
import {
  InviteToHomeDocument,
  type InviteToHomeMutation,
} from '#operations/home/home.generated';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';
import type { InviteToHomeInput } from '#/graphql/generated/schemaTypes';

/**
 * Invite someone to a home. Onboarding's own, because it invites the first
 * members before the home feature's screens are reachable.
 */
export function useInviteToHome(onError: (error: Error) => void) {
  const [inviteToHome] = useMutation(InviteToHomeDocument, { onError });

  return {
    inviteToHome: (
      input: InviteToHomeInput,
    ): Promise<MutationOutcome<InviteToHomeMutation>> =>
      inviteToHome({ variables: { input } }),
  };
}
