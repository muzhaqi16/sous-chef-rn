import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import {
  getPantryPermissions,
  type PantryPermissions,
} from '#utils/permissions/pantryPermissions';

/**
 * Used while the home's membership is unknown. "Unknown" is deliberately not
 * "denied": the API is the enforcement point, and failing closed here renders UI
 * that looks live and silently no-ops. A loaded membership still restricts.
 */
const UNKNOWN_MEMBERSHIP_PERMISSIONS: PantryPermissions = {
  canView: true,
  canAddItems: true,
  canEditItems: true,
  canCreatePantry: true,
  canDeletePantry: true,
};

/**
 * Reads `myMembership` via `useCurrentHome` rather than the heavier
 * `useCurrentPantry`, so no consumer re-runs pantry resolution.
 */
export function usePantryPermissions(): PantryPermissions {
  const { currentHome } = useCurrentHome();

  return (() => {
    const membership = (
      currentHome as {
        myMembership?: Parameters<typeof getPantryPermissions>[0];
      } | null
    )?.myMembership;
    if (!membership) {
      return UNKNOWN_MEMBERSHIP_PERMISSIONS;
    }
    return getPantryPermissions(membership);
  })();
}
