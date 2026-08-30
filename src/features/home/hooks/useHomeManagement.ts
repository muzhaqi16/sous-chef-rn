/**
 * useHomeManagement - Composition hook for all home operations
 *
 * This maintains backward compatibility with the original hook.
 * For new code, prefer using individual hooks directly:
 * - useHomeQuery: For data fetching
 * - useHomeSelection: For default home logic
 * - useHomeMutations: For CRUD operations
 * - useHomeInvitations: For invites and join by code
 *
 * @example
 * ```tsx
 * // Backward compatible usage
 * const { homes, createHome, setDefaultHome, inviteUserToHome } = useHomeManagement();
 *
 * // Preferred: Use individual hooks
 * const { homes, stats } = useHomeQuery();
 * const { setDefaultHome } = useHomeSelection({ homes, remoteDefaultHomeId });
 * ```
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
    selectedHome,
    isSynced,
    setDefaultHome,
    setSelectedHomeId,
    setSelectedPantryId,
  } = useHomeSelection({
    homes,
    remoteDefaultHomeId,
  });

  // Mutations hook - CRUD operations
  const { createHome, updateHome, deleteHome, creating, updating, deleting } =
    useHomeMutations({
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
    // Which home the user is VIEWING, and which one the account defaults to.
    // These are different questions and `defaultHomeId` used to answer the
    // first — so the "Default" chip followed the local selection and could
    // point at one home while the server said another.
    selectedHome,
    selectedHomeId,
    remoteDefaultHomeId,
    isSynced,
    loading,
    initialLoading,
    error,
    stats,
    previewHome,

    // Loading states
    creating,
    updating,
    deleting,
    inviting,
    joiningByCode,
    loadingPreview,

    // Actions
    createHome,
    updateHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    refetch,
  };
}
