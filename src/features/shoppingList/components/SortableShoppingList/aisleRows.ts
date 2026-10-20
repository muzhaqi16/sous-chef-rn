import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import {
  isKnownDepartment,
  knownDepartment,
} from '#features/shoppingList/utils/aisles';
import {
  isAisleHeader,
  type AisleHeaderRow,
  type ShoppingListEntry,
  type ShoppingListRowItem,
} from './types';

// FlashList re-renders a cell only when its item changes identity, so the same
// rows and route hand back the same array.
const groupedCache = new WeakMap<
  readonly ShoppingListRowItem[],
  { route: readonly string[] | null; result: ShoppingListEntry[] }
>();

/**
 * The lines under a heading per aisle, aisles in the route's walking order.
 * An aisle the route leaves out follows in the order the list meets it, and
 * OTHER comes last unless the route places it.
 */
export function groupByAisle(
  rows: ShoppingListRowItem[],
  route: readonly string[] | null,
): ShoppingListEntry[] {
  if (rows.length === 0) return rows;
  const cached = groupedCache.get(rows);
  if (cached?.route === route) return cached.result;

  const byDepartment = new Map<StoreDepartment, ShoppingListRowItem[]>();
  for (const row of rows) {
    const department = knownDepartment(row.storeDepartment);
    const lines = byDepartment.get(department);
    if (lines) lines.push(row);
    else byDepartment.set(department, [row]);
  }

  const walk = new Set<StoreDepartment>();
  for (const department of route ?? []) {
    if (isKnownDepartment(department) && byDepartment.has(department)) {
      walk.add(department);
    }
  }
  for (const department of byDepartment.keys()) {
    if (department !== StoreDepartment.Other) walk.add(department);
  }
  if (byDepartment.has(StoreDepartment.Other)) walk.add(StoreDepartment.Other);

  const result: ShoppingListEntry[] = [];
  for (const department of walk) {
    const lines = byDepartment.get(department) ?? [];
    const header: AisleHeaderRow = {
      id: `aisle:${department}`,
      department,
      count: lines.length,
    };
    result.push(header, ...lines);
  }
  groupedCache.set(rows, { route, result });
  return result;
}

const aisleLinesCache = new WeakMap<
  readonly ShoppingListEntry[],
  Map<StoreDepartment, ShoppingListRowItem[]>
>();

/** One aisle's lines out of the grouped list, without its heading. */
export function linesInAisle(
  entries: ShoppingListEntry[],
  department: StoreDepartment,
): ShoppingListRowItem[] {
  let byAisle = aisleLinesCache.get(entries);
  if (!byAisle) {
    byAisle = new Map();
    aisleLinesCache.set(entries, byAisle);
  }
  const cached = byAisle.get(department);
  if (cached) return cached;

  const lines: ShoppingListRowItem[] = [];
  let inAisle = false;
  for (const entry of entries) {
    if (isAisleHeader(entry)) inAisle = entry.department === department;
    else if (inAisle) lines.push(entry);
  }
  byAisle.set(department, lines);
  return lines;
}
