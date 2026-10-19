import { generateEntityId } from '#/utils/generateEntityId';
import { itemIdOf, typedItemRef } from '#/utils/refInput';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';
import type { ShoppingRowLine } from '../cache/createShoppingListRow';
import { lineUnitFields } from './lineUnit';

/** One line of the list being copied, as `CopyableShoppingListFragment` caches it. */
export interface CopyableLine {
  id: string;
  itemName?: string | null;
  quantity?: number | null;
  quantityInput?: string | null;
  category?: string | null;
  notes?: string | null;
  unitName?: string | null;
  unitId?: string | null;
  itemId?: string | null;
  sortOrder?: string | null;
}

/** The list being copied, settings and lines together. */
export interface CopyableList {
  id: string;
  name: string;
  description?: string | null;
  budgetAmount?: number | null;
  tags?: string[] | null;
  homeId?: string | null;
  lines: CopyableLine[];
}

/** What the copied row shows before the server answers. */
export interface CopiedLineDisplay {
  itemName: string;
  quantity?: number | null;
  quantityInput?: string | null;
  unitName?: string | null;
  category?: string | null;
  itemId?: string | null;
  unitId?: string | null;
}

export type CopySkipReason = 'line-names-nothing';

export interface DerivedList {
  /** No `id`: the create hook mints the list's own key. */
  list: CreateShoppingListInput;
  items: (ShoppingRowLine & { id: string })[];
  /** Minted line id to what the optimistic row renders. */
  display: Map<string, CopiedLineDisplay>;
  skipped: Array<{ sourceId: string; reason: CopySkipReason }>;
}

interface CopyOptions {
  /** Already resolved and localized by the caller. */
  name: string;
  mintId?: () => string;
}

/**
 * A cached list as the create-plus-lines it implies, mirroring the server's copy:
 * settings and every line, purchased included, landing unpurchased. The server
 * fills `basedOnTemplateId`, `shareCount`, line `priority` and price estimates.
 */
export function listFromTemplate(
  source: CopyableList,
  options: CopyOptions,
): DerivedList {
  const mint = options.mintId ?? generateEntityId;
  const skipped: DerivedList['skipped'] = [];
  const items: DerivedList['items'] = [];
  const display = new Map<string, CopiedLineDisplay>();

  for (const line of source.lines) {
    // A line names a catalog item, else its typed name under a minted item
    // id; one carrying neither is reported rather than sent blank.
    const item = line.itemId
      ? { itemId: line.itemId }
      : line.itemName
      ? typedItemRef(line.itemName, mint)
      : null;
    if (!item) {
      skipped.push({ sourceId: line.id, reason: 'line-names-nothing' });
      continue;
    }

    const lineId = mint();
    display.set(lineId, {
      itemName: line.itemName ?? '',
      quantity: line.quantity,
      quantityInput: line.quantityInput,
      unitName: line.unitName,
      category: line.category,
      itemId: itemIdOf(item),
      unitId: line.unitId,
    });
    items.push({
      id: lineId,
      item,
      ...lineUnitFields(line.unitId, line.unitName),
      ...(line.quantity != null && { quantity: line.quantity }),
      ...(line.notes != null && { notes: line.notes }),
      ...(line.category != null && { category: line.category }),
      ...(line.sortOrder != null && { sortOrder: line.sortOrder }),
    });
  }

  return {
    list: {
      name: options.name,
      ...(source.description != null && { description: source.description }),
      ...(source.budgetAmount != null && {
        budgetAmount: source.budgetAmount,
      }),
      ...(source.tags != null && { tags: source.tags }),
      ...(source.homeId != null && { homeId: source.homeId }),
    },
    items,
    display,
    skipped,
  };
}
