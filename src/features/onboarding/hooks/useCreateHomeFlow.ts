import { useMutation, useQuery } from '@apollo/client/react';
import { ApolloCache, type Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import {
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  CreateHomeDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
  type AcceptHomeInviteMutation,
  type CreateHomeMutation,
  type DeclineHomeInviteMutation,
} from '#operations/home/home.generated';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import { extractNodes } from '#/utils/connectionUtils';
import { logger } from '#/utils/environment';
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

/** Module scope: a throw inside a try in a component body bails the compiler. */
function buildAcceptHomeInviteUpdater(userId: string | undefined) {
  return function acceptHomeInviteUpdater(
    cache: ApolloCache,
    { data }: { data?: AcceptHomeInviteMutation | null },
  ) {
    const acceptPayload = data?.acceptHomeInvite;
    if (
      acceptPayload?.__typename !== 'AcceptHomeInvitePayload' ||
      !acceptPayload.membership?.homeId ||
      !userId
    )
      return;
    try {
      const homeId = acceptPayload.membership.homeId;
      const userCacheId = cache.identify({ __typename: 'User', id: userId });
      if (!userCacheId) return;

      cache.modify({
        id: userCacheId,
        fields: {
          homes(
            existingHomes: readonly Reference[] = [],
            { readField, toReference }: ModifierDetails,
          ) {
            const homeRef = toReference({ __typename: 'Home', id: homeId });
            const exists = existingHomes.some(
              ref => readField('id', ref) === homeId,
            );
            if (exists) return existingHomes;
            return homeRef ? [...existingHomes, homeRef] : existingHomes;
          },
        },
      });
    } catch (error) {
      logger.warn('Cache update failed for acceptHomeInvite:', error);
    }
  };
}

interface CreateHomeFlowArgs {
  userId: string | undefined;
  onInviteAccepted: (homeId: string) => void;
  onInviteError: (error: Error) => void;
  onDeclineError: (error: Error) => void;
}

/**
 * Everything the onboarding home step reads and writes: the account's homes and
 * pending invites, and the create / accept / decline writes.
 */
export function useCreateHomeFlow({
  userId,
  onInviteAccepted,
  onInviteError,
  onDeclineError,
}: CreateHomeFlowArgs) {
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

  const [acceptHomeInvite, { loading: accepting }] = useMutation(
    AcceptHomeInviteDocument,
    {
      update: buildAcceptHomeInviteUpdater(userId),
      onCompleted: data => {
        if (data.acceptHomeInvite?.__typename === 'AcceptHomeInvitePayload') {
          onInviteAccepted(data.acceptHomeInvite.membership.homeId);
        }
      },
      onError: onInviteError,
    },
  );

  // Declining changes only the invite status, so no cache update is needed.
  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument, {
    onError: onDeclineError,
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
    accepting,
    createHome: (
      input: CreateHomeInput,
    ): Promise<MutationOutcome<CreateHomeMutation>> =>
      createHome({ variables: { input } }),
    acceptHomeInvite: (
      token: string,
    ): Promise<MutationOutcome<AcceptHomeInviteMutation>> =>
      acceptHomeInvite({ variables: { input: { token } } }),
    declineHomeInvite: (
      token: string,
    ): Promise<MutationOutcome<DeclineHomeInviteMutation>> =>
      declineHomeInvite({ variables: { input: { token } } }),
  };
}

/** The create call this hook returns, for callers that pass it on. */
export type CreateHomeFn = ReturnType<typeof useCreateHomeFlow>['createHome'];
