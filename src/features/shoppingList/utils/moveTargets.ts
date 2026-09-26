import { MembershipRole } from '#/graphql/generated/schemaTypes';

interface HomeWithPantries {
  id: string;
  name: string;
  myMembership: { role: MembershipRole; canAddItems: boolean } | null;
  pantriesConnection: {
    edges: Array<{
      node: { id: string; name: string; isDefault: boolean };
    }>;
  };
}

export interface MoveTarget {
  id: string;
  name: string;
  isDefault: boolean;
}

export type MoveTargets =
  | { status: 'ready'; pantries: MoveTarget[] }
  | { status: 'noPantry' }
  | { status: 'notAllowed'; homeName: string };

// Mirrors the API's ADD_ITEMS capability: an owner or admin always has it,
// anyone else through the membership's `canAddItems` flag.
function canAddTo(home: HomeWithPantries): boolean {
  const membership = home.myMembership;
  if (!membership) return false;
  return (
    membership.role === MembershipRole.Owner ||
    membership.role === MembershipRole.Admin ||
    membership.canAddItems
  );
}

/**
 * The pantries a single move offers: the selected home's only. The API takes
 * any home the caller can add to, but listing every home's pantries makes a
 * long picker for a choice that is almost always the current home.
 */
export function moveTargets(
  homes: readonly HomeWithPantries[],
  selectedHomeId: string | null,
): MoveTargets {
  const home = homes.find(candidate => candidate.id === selectedHomeId);
  const pantries = (home?.pantriesConnection.edges ?? []).map(
    ({ node }) => node,
  );
  if (!home || pantries.length === 0) return { status: 'noPantry' };
  if (!canAddTo(home)) return { status: 'notAllowed', homeName: home.name };
  return { status: 'ready', pantries };
}

/** The pantry the app is on, else the home's default, else the first. */
export function initialMoveTarget(
  pantries: readonly MoveTarget[],
  preferredPantryId: string | null,
): string | null {
  const preferred =
    pantries.find(pantry => pantry.id === preferredPantryId) ??
    pantries.find(pantry => pantry.isDefault) ??
    pantries[0];
  return preferred?.id ?? null;
}
