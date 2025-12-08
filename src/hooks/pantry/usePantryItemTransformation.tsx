import React, { useMemo } from 'react';
import { View, Image, Text } from 'react-native';
import { FormattedItemSubtitle } from '#components';
import { getItemImageUrl } from '#utils/imageUtils';
import { getEffectiveUnitSymbol } from '#utils/pantryItemUtils';
import { commonStyles } from '#/styles';
import { StorageState } from '#generated';

interface PantryItem {
  id: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  currentQuantity: number;
  initialQuantity?: number | null;
  autoReorderPoint?: number | null;
  storageState?: string | null;
  lowStockAlert?: boolean | null;
  // Pantry item's own weight (override)
  packageWeight?: number | null;
  packageWeightUnit?: {
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

// Helper to get time-based info for list display
const getItemTimeInfo = (item: PantryItem): { text: string; color: string; isUrgent: boolean } | null => {
  const now = new Date();

  // Check expiry first
  if (item.expiresAt) {
    const expiry = new Date(item.expiresAt);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)} days ago!`, color: 'error', isUrgent: true };
    }
    if (diffDays === 0) {
      return { text: 'Expires today!', color: 'warning', isUrgent: true };
    }
    if (diffDays === 1) {
      return { text: 'Expiring in 1 day!', color: 'warning', isUrgent: true };
    }
    if (diffDays <= 7) {
      return { text: `Expiring in ${diffDays} days!`, color: 'warning', isUrgent: diffDays <= 3 };
    }
  }

  // Fall back to "X days in" based on createdAt
  if (item.createdAt) {
    const created = new Date(item.createdAt);
    const daysIn = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (daysIn === 0) {
      return { text: 'Added today', color: 'textSecondary', isUrgent: false };
    }
    if (daysIn === 1) {
      return { text: '1 day in', color: 'textSecondary', isUrgent: false };
    }
    return { text: `${daysIn} days in`, color: 'textSecondary', isUrgent: false };
  }

  return null;
};

// Helper to format storage state for display
const formatStorageState = (state?: string | null): string => {
  if (!state) return '';
  const mapping: Record<string, string> = {
    [StorageState.Refrigerated]: 'Fridge',
    [StorageState.Frozen]: 'Freezer',
    [StorageState.Ambient]: 'Dry pantry',
  };
  return mapping[state] || state;
};

interface ThemeColors {
  surface: string;
  error: string;
  warning: string;
  textSecondary: string;
  textPrimary: string;
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
  rightElement?: React.JSX.Element;
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
      // Calculate expired status for badge
      const isExpired =
        item.expiresAt && new Date(item.expiresAt) < new Date();

      // Get time info for subtitle display
      const timeInfo = getItemTimeInfo(item);

      // Get image URL for the item
      const imageUrl = getItemImageUrl(item.item);

      // Use packageWeight if set (user override), otherwise fall back to catalog item weight
      const effectiveNetWeight = item.packageWeight ?? item.item?.netWeight;
      const effectiveWeightUnitSymbol = getEffectiveUnitSymbol(item);

      // Format quantity display
      const quantityDisplay = effectiveNetWeight && effectiveWeightUnitSymbol
        ? `${effectiveNetWeight} ${effectiveWeightUnitSymbol}`
        : `${item.currentQuantity} pcs`;

      // Format storage location
      const storageDisplay = formatStorageState(item.storageState);

      // Determine subtitle text color based on time info
      const getSubtitleColor = () => {
        if (!timeInfo) return theme.colors.textSecondary;
        if (timeInfo.color === 'error') return theme.colors.error;
        if (timeInfo.color === 'warning') return theme.colors.warning;
        return theme.colors.textSecondary;
      };

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle: timeInfo ? (
          <Text style={{ color: getSubtitleColor(), fontSize: 14 }}>
            {timeInfo.text}
          </Text>
        ) : (
          <FormattedItemSubtitle
            quantity={item.currentQuantity}
            initialQuantity={item.initialQuantity}
            netWeight={effectiveNetWeight}
            unitSymbol={effectiveWeightUnitSymbol}
            additionalInfo={item.storageState ?? undefined}
          />
        ),
        rightElement: (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontWeight: '500', fontSize: 14, color: theme.colors.textPrimary }}>
              {quantityDisplay}
            </Text>
            {storageDisplay ? (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {storageDisplay}
              </Text>
            ) : null}
          </View>
        ),
        // Only show badge for expired items - low stock and expiring info
        // is already shown in subtitle text with appropriate colors
        badge: isExpired
          ? { text: 'Expired', variant: 'danger' as const }
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
