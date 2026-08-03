import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import {
  getPantryPermissions,
  type PantryPermissions,
} from '#utils/permissions/pantryPermissions';

/**
 * Used while the current home's membership is unknown — the home hasn't
 * resolved from the cache yet, or the cached entity predates `myMembership`
 * being selected. "Unknown" is not "denied": the API is the enforcement point,
 * and every gated action fails there with a real error if it truly isn't
 * allowed.
 *
 * Failing closed here instead produced UI that looks live but does nothing —
 * the tab bar's add button rendered and silently no-opped, item swipe actions
 * vanished, and PantrySettings' create button sat disabled — with no way for
 * the user to tell that anything was wrong. A loaded membership still
 * restricts normally, so a genuine Guest is unaffected.
 */
const UNKNOWN_MEMBERSHIP_PERMISSIONS: PantryPermissions = {
  canView: true,
  canAddItems: true,
  canEditItems: true,
  canManagePantry: true,
};

/**
 * Hook that computes pantry permissions based on the current user's
 * home membership.
 *
 * Reads myMembership from the cached home data (via `useCurrentHome`, not the
 * heavier `useCurrentPantry`) so it works without an additional network
 * request and without re-running pantry resolution on every consumer.
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
