/**
 * Composes the four home hooks — `useHomeQuery`, `useHomeSelection`,
 * `useHomeMutations`, `useHomeInvitations` — into one surface. Prefer the
 * individual hooks in new code; a consumer that needs one of them should not
 * mount all four.
 */

import { useHomeQuery } from './useHomeQuery';
import { useHomeSelection } from './useHomeSelection';
import { useHomeMutations } from './useHomeMutations';
import { useHomeInvitations } from './useHomeInvitations';

// MembershipRole is available from '#generated' directly
// import { MembershipRole } from '#/graphql/generated/schemaTypes';

export function useHomeManagement() {
  // Query hook - fetches homes and computes stats
  const {
    homes,
    remoteDefaultHomeId,
    loading,
    initialLoading,
    error,
    stats,
    refetch,
  } = useHomeQuery();

  // Selection hook - handles default home logic
  const {
    selectedHomeId,
    setDefaultHome,
    setSelectedHomeId,
    setSelectedPantryId,
  } = useHomeSelection({
    homes,
    remoteDefaultHomeId,
  });

  // Mutations hook - CRUD operations
  const { createHome, deleteHome, creating, deleting } = useHomeMutations({
    refetch,
    setDefaultHome,
    setSelectedPantryId,
  });

  // Invitations hook - invite and join operations
  const {
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    previewHome,
    inviting,
    joiningByCode,
    loadingPreview,
  } = useHomeInvitations({
    homes,
    refetch,
    setDefaultHome,
    setSelectedHomeId,
  });

  return {
    // Data
    homes,
    allHomes: homes,
    selectedHomeId,
    remoteDefaultHomeId,
    loading,
    initialLoading,
    error,
    stats,
    previewHome,

    // Loading states
    creating,
    deleting,
    inviting,
    joiningByCode,
    loadingPreview,

    // Actions
    createHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    refetch,
  };
}
