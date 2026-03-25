import { useCurrentPantry } from '#/hooks/pantry/useCurrentPantry';
import {
  getPantryPermissions,
  type PantryPermissions,
} from '#utils/permissions/pantryPermissions';

const NO_PERMISSIONS: PantryPermissions = {
  canView: false,
  canAddItems: false,
  canEditItems: false,
  canManagePantry: false,
};

/**
 * Hook that computes pantry permissions based on the current user's
 * home membership.
 *
 * Reads myMembership from the cached home data (via useCurrentPantry)
 * so it works without an additional network request.
 */
export function usePantryPermissions(): PantryPermissions {
  const { currentHome } = useCurrentPantry();

  return (() => {
    if (!currentHome?.myMembership) {
      return NO_PERMISSIONS;
    }
    return getPantryPermissions(currentHome.myMembership);
  })();
}
