/**
 * useHomeInvitations - Invitation and join by code mutations
 *
 * Single responsibility:
 * - Invite users to home
 * - Join home by code
 * - Preview home by code
 */

import { Alert } from 'react-native';
import {
  useInviteToHomeMutation,
  useJoinHomeByCodeMutation,
  useGetHomeByJoinCodeLazyQuery,
  MembershipRole,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import { normalizeHome } from '#/utils/connectionUtils';
import { executeCacheUpdate, executeMutation, executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

const addInviteToHomeCache = createAddToParentConnectionUpdater(
  'Home',
  'invitesConnection',
  'HomeInvite',
);

interface UseHomeInvitationsOptions {
  homes: any[] | null;
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
  const { handleApolloError } = useErrorService();

  // Invite user to home mutation
  const [inviteUserMutation, { loading: inviting }] = useInviteToHomeMutation({
    errorPolicy: 'all',
    update: (cache, { data }, { variables }) => {
      if (!data?.inviteToHome?.homeInvite || !variables) return;

      executeCacheUpdate(
        () => {
          addInviteToHomeCache(cache, variables.input.homeId, data.inviteToHome!.homeInvite!, { position: 'end' });
        },
        'Cache update failed for inviteUser:',
      );
    },

    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Invite User',
      });
      Alert.alert('Error', message);
    },
  });

  // Join home by code mutation
  const [joinHomeByCodeMutation, { loading: joiningByCode }] =
    useJoinHomeByCodeMutation({
      errorPolicy: 'all',
      // Note: No optimistic response or manual cache update
      // The mutation returns only Membership data (not the full Home object)
      // We refetch GetHomesQuery to get the complete home with all fields
      update: (_cache, { data }) => {
        if (!data?.joinHomeByCode?.membership) return;

        executeCacheUpdate(
          () => { refetch(); },
          'Failed to refetch homes after join:',
        );
      },
      onCompleted: data => {
        if (data?.joinHomeByCode?.membership) {
          const homeId = data.joinHomeByCode.membership.homeId;

          // Set as default if this is the first home
          const freshHomes = homes || [];
          if (freshHomes.length === 0) {
            setSelectedHomeId(homeId);
            setDefaultHome(homeId).catch((error: any) => {
              console.warn('Failed to set default home after join:', error);
            });
          }

          Alert.alert('Success', 'You have successfully joined the home!');
        }
      },
      onError: (error: any) => {
        const { message } = handleApolloError(error, {
          operation: 'Join Home By Code',
        });
        Alert.alert('Error', message);
      },
    });

  // Preview home by join code query
  const [getHomeByJoinCode, { loading: loadingPreview, data: previewData }] =
    useGetHomeByJoinCodeLazyQuery({
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

    return result.data;
  };

  const joinHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a join code');
      return false;
    }

    const result = await executeMutation(
      () => joinHomeByCodeMutation({
        variables: { joinCode: joinCode.trim() },
      }),
      'Join home by code error:',
    );
    if (!result) return false;

    return result.data?.joinHomeByCode?.membership || false;
  };

  const previewHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      return null;
    }

    const result = await executeMutationWithErrorHandler(
      () => getHomeByJoinCode({
        variables: { joinCode: joinCode.trim() },
      }),
      (error: any) => {
        const { message } = handleApolloError(error, {
          operation: 'Preview Home',
        });
        Alert.alert('Error', message);
      },
    );
    if (!result) return null;

    return result.data?.homeByJoinCode || null;
  };

  const previewHome = previewData?.homeByJoinCode
    ? normalizeHome(previewData.homeByJoinCode)
    : null;

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
// import { MembershipRole } from '#generated';
