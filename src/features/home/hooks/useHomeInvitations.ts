/** Invite, preview-by-code, and join-by-code mutations. */

import { alertService } from '#/services/alertService';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import {
  InviteToHomeDocument,
  JoinHomeByCodeDocument,
  GetHomeByJoinCodeDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { t } from '#/i18n';
import { errorService, localizedErrorMessage } from '#/services/errorService';

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

export function useHomeInvitations({
  homes,
  refetch,
  setDefaultHome,
  setSelectedHomeId,
}: UseHomeInvitationsOptions) {
  const [inviteUserMutation] = useMutation(InviteToHomeDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload || !variables) return;

      try {
        addInviteToHomeCache(
          cache,
          variables.input.homeId,
          payload.homeInvite,
          { position: 'end' },
        );
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for inviteUser:',
        });
      }
    },
  });

  // No optimistic write: the payload carries only the Membership, not the
  // Home, so the homes list is refetched for the complete row.
  const [joinHomeByCodeMutation, { loading: joiningByCode }] = useMutation(
    JoinHomeByCodeDocument,
    {
      update: (_cache, { data }) => {
        if (!appliedPayload(data)) return;

        refetch().catch((refetchError: unknown) => {
          errorService.reportError(refetchError, {
            operation: 'Failed to refetch homes after join:',
          });
        });
      },
    },
  );

  // Preview home by join code query
  const [getHomeByJoinCode, { loading: loadingPreview, data: previewData }] =
    useLazyQuery(GetHomeByJoinCodeDocument, {
      fetchPolicy: 'network-only', // Always fetch fresh data (one-time operation)
    });

  /**
   * The localized reason the invite was not sent, or null once it was. A
   * refusal is returned rather than alerted so the invite modal shows it inline
   * and stays open.
   */
  const inviteUserToHome = async (
    homeId: string,
    email: string,
    role: MembershipRole = MembershipRole.Member,
  ): Promise<string | null> => {
    const settled = await settleMutation(
      () =>
        inviteUserMutation({
          variables: { input: { homeId, email: email.trim(), role } },
        }),
      {
        document: InviteToHomeDocument,
        fallback: t('errors.sendInviteFailed'),
        present: 'none',
      },
    );
    return settled.failure?.body ?? null;
  };

  const joinHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      alertService.alert(t('labels.error'), t('labels.pleaseEnterAJoinCode'));
      return false;
    }

    const settled = await settleMutation(
      () =>
        joinHomeByCodeMutation({
          variables: { input: { joinCode: joinCode.trim() } },
        }),
      { document: JoinHomeByCodeDocument, fallback: t('joinHome.joinFailed') },
    );
    const payload = appliedPayload(settled.data);
    if (!payload) return false;

    // The PROP, not a cache read: the question is whether the user had zero
    // homes BEFORE this join, and the prop is that pre-join snapshot (a cache
    // read would race the un-awaited `refetch()`). `setDefaultHome` must not
    // require a local record, since the joined home is in neither yet.
    const { homeId } = payload.membership;
    if ((homes ?? []).length === 0) {
      setSelectedHomeId(homeId);
      // Presents its own failure and rolls the selection back.
      void setDefaultHome(homeId);
    }

    alertService.alert(t('labels.success'), t('home.joinSuccessBody'));
    return payload.membership;
  };

  const previewHomeByCode = async (joinCode: string) => {
    if (!joinCode.trim()) {
      return null;
    }

    let result;
    try {
      result = await getHomeByJoinCode({
        variables: { joinCode: joinCode.trim() },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Preview Home' });
      alertService.alert(
        t('labels.error'),
        localizedErrorMessage(error, t('errors.codes.genericRetry')),
      );
    }
    if (!result) return null;

    return result.data?.homeByJoinCode ?? null;
  };

  const previewHome = previewData?.homeByJoinCode ?? null;

  return {
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    previewHome,
    joiningByCode,
    loadingPreview,
  };
}
