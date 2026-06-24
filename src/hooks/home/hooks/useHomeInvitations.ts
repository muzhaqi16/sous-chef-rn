/**
 * useHomeInvitations - Invitation and join by code mutations
 *
 * Single responsibility:
 * - Invite users to home
 * - Join home by code
 * - Preview home by code
 */

import { alertService } from '#/services/alertService';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import {
  InviteToHomeDocument,
  JoinHomeByCodeDocument,
  GetHomeByJoinCodeDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  executeCacheUpdate,
  executeMutation,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { t } from '#/i18n/t';

const addInviteToHomeCache = createAddToParentConnectionUpdater(
  'Home',
  'invitesConnection',
  'HomeInvite',
);

type HomeNode = GetHomesQuery['homes']['edges'][number]['node'];

interface UseHomeInvitationsOptions {
  homes: HomeNode[] | null;
  refetch: () => Promise<void>;
  setDefaultHome: (homeId: string) => Promise<boolean>;
  setSelectedHomeId: (homeId: string) => void;
}

/**
 * Hook for home invitation and join operations
 *
 * @example
 * ```tsx
 * const { inviteUserToHome, joinHomeByCode, previewHomeByCode, inviting, joiningByCode } =
 *   useHomeInvitations({ homes, refetch, setDefaultHome, setSelectedHomeId });
 * ```
 */
export function useHomeInvitations({
  homes,
  refetch,
  setDefaultHome,
  setSelectedHomeId,
}: UseHomeInvitationsOptions) {
  // Invite user to home mutation
  const [inviteUserMutation, { loading: inviting }] = useMutation(
    InviteToHomeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.inviteToHome;
        if (payload?.__typename !== 'InviteToHomePayload' || !variables) {
          return;
        }

        executeCacheUpdate(() => {
          addInviteToHomeCache(
            cache,
            variables.input.homeId,
            payload.homeInvite,
            { position: 'end' },
          );
        }, 'Cache update failed for inviteUser:');
      },

      // Error/rejection handling lives in inviteUserToHome below; the update
      // callback (above) runs only on the success payload.
    },
  );

  // Join home by code mutation
  const [joinHomeByCodeMutation, { loading: joiningByCode }] = useMutation(
    JoinHomeByCodeDocument,
    {
      // Note: No optimistic response or manual cache update
      // The mutation returns only Membership data (not the full Home object)
      // We refetch GetHomesQuery to get the complete home with all fields
      update: (_cache, { data }) => {
        if (data?.joinHomeByCode?.__typename !== 'JoinHomeByCodePayload')
          return;

        executeCacheUpdate(() => {
          refetch();
        }, 'Failed to refetch homes after join:');
      },
      onCompleted: data => {
        if (data?.joinHomeByCode?.__typename === 'JoinHomeByCodePayload') {
          const homeId = data.joinHomeByCode.membership.homeId;

          // Set as default if this is the first home
          const freshHomes = homes || [];
          if (freshHomes.length === 0) {
            setSelectedHomeId(homeId);
            setDefaultHome(homeId).catch((error: unknown) => {
              console.warn('Failed to set default home after join:', error);
            });
          }

          alertService.alert(
            'Success',
            'You have successfully joined the home!',
          );
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Join Home By Code' });
      },
    },
  );

  // Preview home by join code query
  const [getHomeByJoinCode, { loading: loadingPreview, data: previewData }] =
    useLazyQuery(GetHomeByJoinCodeDocument, {
      fetchPolicy: 'network-only', // Always fetch fresh data (one-time operation)
    });

  const inviteUserToHome = async (
    homeId: string,
    email: string,
    role: MembershipRole = MembershipRole.Member,
  ) => {
    const result = await inviteUserMutation({
      variables: {
        input: {
          homeId,
          email: email.trim(),
          role,
        },
      },
    });
    // A resolved `*Error` union member and a transport error both resolve
    // without throwing under errorPolicy:'all'. Throw here (via unwrapPayload)
    // so the invite modal's screen-level catch surfaces the message inline and
    // keeps itself open — instead of a native alert firing while the modal
    // closes as though the invite succeeded.
    unwrapPayload(
      result.data?.inviteToHome,
      'InviteToHomePayload',
      t('errors.sendInviteFailed'),
    );
    return result.data;
  };

  const joinHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      alertService.alert('Error', 'Please enter a join code');
      return false;
    }

    const result = await executeMutation(
      () =>
        joinHomeByCodeMutation({
          variables: { input: { joinCode: joinCode.trim() } },
        }),
      'Join home by code error:',
    );
    if (!result) return false;

    return result.data?.joinHomeByCode?.__typename === 'JoinHomeByCodePayload'
      ? result.data.joinHomeByCode.membership
      : false;
  };

  const previewHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      return null;
    }

    const result = await executeMutation(
      () =>
        getHomeByJoinCode({
          variables: { joinCode: joinCode.trim() },
        }),
      error => {
        handleMutationError(error, { operation: 'Preview Home' });
      },
    );
    if (!result) return null;

    return result.data?.homeByJoinCode || null;
  };

  const previewHome = previewData?.homeByJoinCode ?? null;

  return {
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    previewHome,
    inviting,
    joiningByCode,
    loadingPreview,
  };
}

// MembershipRole is available from '#generated' directly
// import { MembershipRole } from '#/graphql/generated/schemaTypes';
