/**
 * Settling a home replay: the membership row is the one thing the client cannot
 * key, so the server's replaces the placeholder the create wrote.
 */
import { adoptServerMembership } from '#features/home/cache/optimisticHome';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';

export const HOME_REPLAY_RECONCILERS: ReplayReconcilerTable = {
  CreateHome: (cache, variables, data) => {
    const homeId = (variables.input as { id?: string } | undefined)?.id;
    if (!homeId) return;

    const payload = extractMutationPayload(data) as
      | { home?: { myMembership?: { id?: string } | null } }
      | null
      | undefined;
    const serverMembershipId = payload?.home?.myMembership?.id;
    if (!serverMembershipId) return;

    adoptServerMembership(cache, homeId, serverMembershipId);
  },
};
