import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { FormattedItemSubtitle } from '#components';
import { getItemImageUrl } from '#utils/imageUtils';
import { commonStyles } from '#/styles';

interface PantryItem {
  id: string;
  expiresAt?: string | null;
  currentQuantity: number;
  autoReorderPoint?: number | null;
  storageState?: string | null;
  // Pantry item's own weight (override)
  actualNetWeight?: number | null;
  actualNetWeightUnit?: {
    symbol?: string;
  } | null;
  item?: {
    name?: string;
    netWeight?: number | null;
    displayUnit?: {
      symbol?: string;
    } | null;
  } | null;
  unit?: {
    symbol?: string;
  } | null;
}

interface ThemeColors {
  surface: string;
}

interface TransformedItem {
  id: string;
  title: string;
  subtitle: React.JSX.Element;
  badge?: {
    text: string;
    variant: 'danger' | 'warning';
  };
  leftElement?: React.JSX.Element;
}

interface UsePantryItemTransformationOptions<T extends PantryItem> {
  /**
   * Array of pantry items to transform
   */
  items: T[];

  /**
   * Theme object containing colors and styling
   */
  theme: {
    colors: ThemeColors;
  };
}

/**
 * Hook to transform raw pantry items into display-ready list items
 *
 * Transforms pantry items by:
 * - Calculating expiration status
 * - Determining low stock status
 * - Formatting subtitle with quantity and unit information
 * - Adding appropriate badges (Expired, Low Stock)
 * - Including item images when available
 *
 * @param options - Configuration options
 * @returns Array of transformed items ready for list display
 *
 * @example
 * ```typescript
 * const transformedItems = usePantryItemTransformation({
 *   items: pantryItems,
 *   theme: themeObject,
 * });
 *
 * <ListTemplate items={transformedItems} />
 * ```
 */
export function usePantryItemTransformation<T extends PantryItem>(
  options: UsePantryItemTransformationOptions<T>,
): TransformedItem[] {
  const { items, theme } = options;

  return useMemo(() => {
    return items.map(item => {
      // Calculate status flags
      const isExpired =
        item.expiresAt && new Date(item.expiresAt) < new Date();
      const isLowStock =
        item.autoReorderPoint && item.currentQuantity <= item.autoReorderPoint;

      // Get image URL for the item
      const imageUrl = getItemImageUrl(item.item);

      // Use actualNetWeight if set (user override), otherwise fall back to catalog item weight
      const effectiveNetWeight = item.actualNetWeight ?? item.item?.netWeight;
      const effectiveWeightUnitSymbol =
        item.actualNetWeightUnit?.symbol ||
        item.item?.displayUnit?.symbol ||
        item.unit?.symbol;

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle: (
          <FormattedItemSubtitle
            quantity={item.currentQuantity}
            netWeight={effectiveNetWeight}
            unitSymbol={effectiveWeightUnitSymbol}
            additionalInfo={item.storageState ?? undefined}
          />
        ),
        badge: isExpired
          ? { text: 'Expired', variant: 'danger' as const }
          : isLowStock
          ? { text: 'Low Stock', variant: 'warning' as const }
          : undefined,
        leftElement: imageUrl ? (
          <View
            style={[
              commonStyles.listItemImageContainer,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={[commonStyles.listItemImage, { resizeMode: 'contain' }]}
            />
          </View>
        ) : undefined,
      };
    });
  }, [items, theme]);
}
