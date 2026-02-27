import { resolveImageUrl } from '#utils/imageUtils';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import type { ShoppingListItemDisplayFragment } from '#generated';
import type {
  SortableShoppingListItem,
  QuantityElementConfig,
  ImageElementConfig,
} from '#components/organisms/SortableShoppingList/types';

interface TransformOptions {
  /**
   * Force the isPurchased state for all items.
   * Use this when items are already filtered by purchase status
   * to ensure checkbox state matches the tab they're in.
   */
  forcePurchasedState?: boolean;
}

/**
 * Options for consolidated multi-source transform.
 * Pass multiple arrays to transform them all in a single hook call.
 */
interface MultiSourceTransformOptions {
  /** Pre-filtered unpurchased items (from pagination) */
  rawUnpurchasedItems: ShoppingListItemDisplayFragment[];
  /** Pre-filtered purchased items (from pagination) */
  rawPurchasedItems: ShoppingListItemDisplayFragment[];
}

/**
 * Transform a single item to SortableShoppingListItem format.
 * Pure function extracted for reuse across different transform modes.
 */
function transformItem(
  item: ShoppingListItemDisplayFragment,
  forcePurchasedState?: boolean,
  showImages: boolean = true,
): SortableShoppingListItem | null {
  // Skip items without ID or name (invalid/corrupt data)
  if (!item.id || !item.itemName) {
    if (__DEV__) {
      console.warn('⚠️ Skipping invalid shopping list item:', item.id);
    }
    return null;
  }

  const imageUrl = resolveImageUrl(item);

  // Use forced state if provided, otherwise read from server data
  const isPurchasedValue = forcePurchasedState ?? item.purchaseInfo?.isPurchased;

  // Create quantity config
  const rightElementConfig: QuantityElementConfig = {
    type: 'quantity',
    quantity: item.quantity || 0,
    quantityInput: item.quantityInput,
    unit: item.unitName || item.unit?.symbol || undefined,
    itemId: item.id,
    disabled: isPurchasedValue ?? false,
  };

  // Create image config (only if images are enabled and image exists)
  const leftElementConfig: ImageElementConfig | undefined =
    showImages && imageUrl
      ? {
          type: 'image',
          url: imageUrl,
          isPurchased: isPurchasedValue,
        }
      : undefined;

  return {
    id: item.id,
    title: item.itemName || '',
    subtitle: item.category || undefined,
    sortOrder: item.sortOrder ?? 'zzz',
    isPurchased: isPurchasedValue,
    rightElementConfig,
    leftElementConfig,
  };
}

/**
 * Transform an array of items, filtering out invalid ones.
 */
function transformItems(
  items: ShoppingListItemDisplayFragment[],
  forcePurchasedState?: boolean,
  showImages: boolean = true,
): SortableShoppingListItem[] {
  return items
    .map(item => transformItem(item, forcePurchasedState, showImages))
    .filter((item): item is SortableShoppingListItem => item !== null);
}

/**
 * useShoppingListTransform - Transform raw items to SortableShoppingListItem
 *
 * Single responsibility:
 * - Transform ShoppingListItemDisplayFragment[] to SortableShoppingListItem[]
 * - Create config objects for quantity and image elements
 * - Partition items by purchase status
 *
 * This hook removes the need for ref-based caching by relying on:
 * 1. React Compiler for automatic memoization (recalculates only when items change)
 * 2. Stable keys on child components
 * 3. Accepting that config objects are recreated when item data changes (which is correct behavior)
 */
export function useShoppingListTransform(
  items: ShoppingListItemDisplayFragment[],
  options?: TransformOptions,
) {
  const { forcePurchasedState } = options ?? {};
  const showImages = useShowShoppingListImages();

  // Transform items using the extracted helper function
  const sortableItems = transformItems(items, forcePurchasedState, showImages);

  // Partition by purchase status
  const unpurchasedItems = sortableItems.filter(item => !item.isPurchased);
  const purchasedItems = sortableItems.filter(item => item.isPurchased);

  return {
    sortableItems,
    unpurchasedItems,
    purchasedItems,
  };
}

/**
 * useShoppingListTransformMulti - Consolidated transform for multiple item sources
 *
 * Use this when you have multiple arrays to transform (e.g., from paginated queries).
 * Transforms all arrays in a single call for better performance.
 *
 * @example
 * ```tsx
 * const { sortableItems, unpurchasedItems, purchasedItems } = useShoppingListTransformMulti({
 *   items,                // All items (combined)
 *   rawUnpurchasedItems,  // Paginated unpurchased
 *   rawPurchasedItems,    // Paginated purchased
 * });
 * ```
 */
export function useShoppingListTransformMulti(options: MultiSourceTransformOptions) {
  const { rawUnpurchasedItems, rawPurchasedItems } = options;
  const showImages = useShowShoppingListImages();

  // Transform only the two partitioned arrays (skip redundant combined transform)
  const unpurchasedItems = transformItems(rawUnpurchasedItems, false, showImages);
  const purchasedItems = transformItems(rawPurchasedItems, true, showImages);

  return { unpurchasedItems, purchasedItems };
}
