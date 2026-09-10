import { useQuery } from '@apollo/client/react';
import {
  GetHomesDocument,
  GetMyPendingInvitesDocument,
} from '#operations/home/home.generated';
import { useCreateHome } from '#features/home/hooks/useCreateHome';
import { extractNodes } from '#/utils/connectionUtils';

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

  // One home create, wherever it is made — the local-first one, which writes
  // the home and the creator's membership before it fires.
  const { createHome } = useCreateHome(() => {
    void refetchHomes();
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
    createHome,
  };
}
