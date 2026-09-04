import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  CreateHomeDocument,
  type CreateHomeMutation,
} from '#operations/home/home.generated';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import { extractNodes } from '#/utils/connectionUtils';
import type { CreateHomeInput } from '#/graphql/generated/schemaTypes';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

interface HomeSummary {
  id: string;
  name?: string;
  pantriesConnection?: unknown;
}

interface PantrySummary {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface CreateHomeFlowArgs {
  userId: string | undefined;
}

/**
 * Everything the onboarding home step reads and writes: the account's homes,
 * its pending invites, and the create write. Redeeming an invite is NOT here —
 * that needs the invite's bearer token, which the API discloses once to the
 * inviter, so it arrives by deep link or notification, never from this list.
 */
export function useCreateHomeFlow({ userId }: CreateHomeFlowArgs) {
  const {
    data: homesData,
    loading: homesLoading,
    refetch: refetchHomes,
  } = useQuery(GetHomesDocument, { skip: !userId });

  const { data: pendingInvitesData, loading: invitesLoading } = useQuery(
    GetMyPendingInvitesDocument,
    { skip: !userId },
  );

  const [createHome] = useMutation(CreateHomeDocument, {
    // `useDefaultHome` fires the app's only GetHomes fetch once per session, and
    // during onboarding that happened when the account had zero homes — so the
    // cached empty list is authoritative and the new home must be written here.
    update: (cache, { data }) => {
      if (data?.createHome?.__typename !== 'CreateHomePayload') return;
      // `cache.modify` skips fields the cache lacks, reporting no write rather
      // than throwing, so refetch instead.
      if (!addToHomesCache(cache, data.createHome.home, { position: 'end' })) {
        void refetchHomes();
      }
    },
  });

  const homes = extractNodes(homesData?.homes) as HomeSummary[];
  const pendingInvites = extractNodes(
    pendingInvitesData?.me?.pendingHomeInvitesConnection,
  );
  const existingHome = homes[0];
  const existingHomePantries = extractNodes(
    existingHome?.pantriesConnection as never,
  ) as PantrySummary[];
  const existingPantry =
    existingHomePantries.find(p => p.isDefault) ?? existingHomePantries[0];

  return {
    homes,
    pendingInvites,
    existingHome,
    existingPantry,
    needsHome: !existingHome,
    needsPantry: !existingPantry,
    homesLoading,
    invitesLoading,
    createHome: (
      input: CreateHomeInput,
    ): Promise<MutationOutcome<CreateHomeMutation>> =>
      createHome({ variables: { input } }),
  };
}

/** The create call this hook returns, for callers that pass it on. */
export type CreateHomeFn = ReturnType<typeof useCreateHomeFlow>['createHome'];
