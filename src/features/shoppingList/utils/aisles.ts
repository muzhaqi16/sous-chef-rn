import { StoreDepartment } from '#/graphql/generated/schemaTypes';

const KNOWN_DEPARTMENTS = new Set<string>(Object.values(StoreDepartment));

export const isKnownDepartment = (value: string): value is StoreDepartment =>
  KNOWN_DEPARTMENTS.has(value);

/** The aisle row's choice: every aisle, or one aisle's lines. */
export type AisleTab = StoreDepartment | 'all';

/**
 * Where to go once `emptied` holds no lines: the next aisle on the walk that
 * still does, else every aisle, so a skipped one is not missed.
 */
export function aisleAfter(
  walk: readonly StoreDepartment[],
  emptied: StoreDepartment,
  remaining: readonly StoreDepartment[],
): AisleTab {
  const after = walk.slice(walk.indexOf(emptied) + 1);
  return after.find(department => remaining.includes(department)) ?? 'all';
}

/** The enum is closed: a department a newer server names reads as OTHER. */
export const knownDepartment = (value: string): StoreDepartment =>
  isKnownDepartment(value) ? value : StoreDepartment.Other;
