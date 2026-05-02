import { createContext } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { resolveImageUrl } from '#utils/imageUtils';
import {
  getExpirationStatus,
  formatPackageBreakdown,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '#hooks/pantry/usePantryItemTransformation';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { type PantryItem } from '../../../graphql/generated/schemaTypes';
import type { ItemVariant } from '../PantryItemCard';
import type { ItemDisplayData, ExpirationColors } from './types';

const getItemVariant = (
  isExpired: boolean,
  isExpiringSoon: boolean,
): ItemVariant => {
  if (isExpired) return 'expired';
  if (isExpiringSoon) return 'warning';
  return 'normal';
};

/** Returns true when at least one usage has been recorded for the item. */
function hasConsumptionStarted(item: PantryItem): boolean {
  if (item.lastUsedAt != null) return true;
  if (
    item.netWeight != null &&
    item.remainingNetWeight != null &&
    item.remainingNetWeight !== item.netWeight
  )
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// Module-level display map cache
// ---------------------------------------------------------------------------

let _lastDisplayMapItems: PantryItem[] | null = null;
let _lastDisplayMapColors: ExpirationColors | null = null;
let _lastDisplayMap: Map<string, ItemDisplayData> = new Map();
let _displayMapHits = 0;
let _displayMapMisses = 0;

const _itemDisplayCache = new Map<string, ItemDisplayData>();
const MAX_ITEM_CACHE = 200;
let _itemCacheColors: ExpirationColors | null = null;

function getItemCacheKey(item: PantryItem): string | null {
  if (!item.updatedAt) return null;
  return `${item.id}:${item.updatedAt}`;
}

/** Value-equality check for theme colors. */
function colorsMatch(a: ExpirationColors | null, b: ExpirationColors): boolean {
  return (
    a != null &&
    a.expired === b.expired &&
    a.warning === b.warning &&
    a.normal === b.normal
  );
}

function computeItemEntry(
  item: PantryItem,
  now: Date,
  expirationColors: ExpirationColors,
  getLocation: (
    storageState?: string | null,
    storageLocation?: { name: string } | null,
  ) => string | null,
  map: Map<string, ItemDisplayData>,
): void {
  const expiresIn = item.expiresAt
    ? differenceInCalendarDays(new Date(item.expiresAt), now)
    : null;
  const expStatus = getExpirationStatus(expiresIn);
  const isExpired = expiresIn !== null && expiresIn < 0;
  const isExpiringSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
  const variant: ItemVariant = getItemVariant(isExpired, isExpiringSoon);
  const hasExpiry = item.expiresAt != null;

  let expirationColor: string | undefined;
  if (hasExpiry) {
    const expType = expStatus.type;
    if (expType === 'expired' || expType === 'critical') {
      expirationColor = expirationColors.expired;
    } else if (expType === 'warning') {
      expirationColor = expirationColors.warning;
    } else {
      expirationColor = expirationColors.normal;
    }
  }

  map.set(item.id, {
    id: item.id,
    name: item.itemName || 'Unknown Item',
    imageUrl: resolveImageUrl(item),
    expirationText: hasExpiry ? expStatus.text : null,
    expirationVariant: hasExpiry ? expStatus.type : undefined,
    expirationColor,
    variant,
    quantityDisplay: formatQuantityDisplay(item.quantity, item.unit?.symbol),
    location: getLocation(item.storageState, item.storageLocation),
    isOutOfStock: item.quantity === 0,
    packageBreakdownText: formatPackageBreakdown(
      item.packageBreakdown,
      item.quantityBreakdown?.totalContentUnits,
    ),
    remainingNetWeightText: hasConsumptionStarted(item)
      ? formatRemainingNetWeight(item.remainingNetWeight, item.netWeightUnit)
      : null,
    quantityBreakdownText: formatQuantityBreakdown(item.quantityBreakdown),
    activeBatchCount: item.activeBatchCount,
  });
}

/**
 * Pre-compute display data for all pantry items at list level.
 * Module-level so the React Compiler doesn't flag Date usage as impure in render.
 * Called once per list render (only when items/colors change), NOT per-item.
 *
 * PERFORMANCE: Caches the result by items + colors reference identity.
 */
export function computeDisplayMap(
  items: PantryItem[],
  expirationColors: ExpirationColors,
  getLocation: (
    storageState?: string | null,
    storageLocation?: { name: string } | null,
  ) => string | null,
): Map<string, ItemDisplayData> {
  // Cache check: reference equality for items + value equality for colors
  if (
    items === _lastDisplayMapItems &&
    colorsMatch(_lastDisplayMapColors, expirationColors)
  ) {
    if (__DEV__) {
      _displayMapHits++;
      if (_displayMapHits % 10 === 0) {
        console.log(
          `[computeDisplayMap] hits=${_displayMapHits} misses=${_displayMapMisses} ratio=${(
            (_displayMapHits / (_displayMapHits + _displayMapMisses)) *
            100
          ).toFixed(1)}%`,
        );
      }
    }
    return _lastDisplayMap;
  }

  // Incremental path: if colors unchanged and items were appended (pagination),
  // reuse existing map entries and only compute the new items.
  const prevItems = _lastDisplayMapItems;
  const isAppend =
    colorsMatch(_lastDisplayMapColors, expirationColors) &&
    prevItems != null &&
    items.length > prevItems.length &&
    prevItems.every((prev, i) => prev.id === items[i].id);

  if (isAppend) {
    if (__DEV__) {
      _displayMapMisses++;
      console.log(
        `[computeDisplayMap] INCREMENTAL — computing ${
          items.length - prevItems.length
        } new items (${prevItems.length}→${items.length})`,
      );
    }
    const now = new Date();
    for (let i = prevItems.length; i < items.length; i++) {
      computeItemEntry(
        items[i],
        now,
        expirationColors,
        getLocation,
        _lastDisplayMap,
      );
    }
    _lastDisplayMapItems = items;
    _lastDisplayMapColors = expirationColors;
    return _lastDisplayMap;
  }

  // Full recompute
  if (__DEV__) {
    _displayMapMisses++;
    console.log(
      `[computeDisplayMap] FULL MISS — items changed: ${
        items !== _lastDisplayMapItems
      }, colors changed: ${!colorsMatch(
        _lastDisplayMapColors,
        expirationColors,
      )}, items.length: ${items.length}`,
    );
  }

  if (!colorsMatch(_itemCacheColors, expirationColors)) {
    _itemDisplayCache.clear();
    _itemCacheColors = expirationColors;
  }

  const map = new Map<string, ItemDisplayData>();
  const now = new Date();
  let cacheHits = 0;
  for (const item of items) {
    const cacheKey = getItemCacheKey(item);
    const cached = cacheKey ? _itemDisplayCache.get(cacheKey) : undefined;
    if (cached) {
      map.set(item.id, cached);
      cacheHits++;
    } else {
      computeItemEntry(item, now, expirationColors, getLocation, map);
      if (cacheKey) {
        const entry = map.get(item.id);
        if (entry) {
          _itemDisplayCache.set(cacheKey, entry);
        }
      }
    }
  }

  if (_itemDisplayCache.size > MAX_ITEM_CACHE) {
    const excess = _itemDisplayCache.size - MAX_ITEM_CACHE;
    const keys = _itemDisplayCache.keys();
    for (let i = 0; i < excess; i++) {
      const key = keys.next().value;
      if (key) _itemDisplayCache.delete(key);
    }
  }

  if (__DEV__ && cacheHits > 0) {
    console.log(
      `[computeDisplayMap] Per-item cache: ${cacheHits}/${items.length} hits`,
    );
  }

  _lastDisplayMapItems = items;
  _lastDisplayMapColors = expirationColors;
  _lastDisplayMap = map;
  return map;
}

// Context for passing pre-computed display map to module-scope renderItem
export const DisplayMapContext = createContext<Map<string, ItemDisplayData>>(
  new Map(),
);

// Get location string — only returns custom storage location names.
// Default storage states (Fridge/Freezer/Pantry) are already represented by filter tabs.
export const getLocationString = (
  _storageState?: string | null,
  storageLocation?: { name: string } | null,
): string | null => {
  if (storageLocation?.name) return storageLocation.name;
  return null;
};
