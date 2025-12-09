import React, { useMemo } from 'react';
import { View, Image, Text } from 'react-native';
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
  storageLocation?: {
    id?: string;
    name?: string;
    type?: string;
  } | null;
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
    category?: {
      id?: string;
      name?: string;
    } | null;
    categories?: Array<{
      isPrimary?: boolean;
      category?: {
        id?: string;
        name?: string;
      } | null;
    }> | null;
  } | null;
  unit?: {
    symbol?: string;
  } | null;
}

// Helper to get URGENT time-based info for list display (expiring/expired only)
const getUrgentTimeInfo = (item: PantryItem): { text: string; color: string } | null => {
  if (!item.expiresAt) return null;

  const now = new Date();
  const expiry = new Date(item.expiresAt);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Expired ${Math.abs(diffDays)}d ago!`, color: 'error' };
  }
  if (diffDays === 0) {
    return { text: 'Expires today!', color: 'warning' };
  }
  if (diffDays === 1) {
    return { text: 'Expires tomorrow!', color: 'warning' };
  }
  if (diffDays <= 7) {
    return { text: `Expires in ${diffDays}d`, color: 'warning' };
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

// Helper to get primary category name from item
const getPrimaryCategory = (item: PantryItem): string | null => {
  // First check for direct category on item
  if (item.item?.category?.name) {
    return item.item.category.name;
  }

  // Then check categories array for primary
  const categories = item.item?.categories;
  if (categories && categories.length > 0) {
    const primary = categories.find(c => c.isPrimary);
    if (primary?.category?.name) {
      return primary.category.name;
    }
    // Fall back to first category if no primary
    if (categories[0]?.category?.name) {
      return categories[0].category.name;
    }
  }

  return null;
};

// Helper to format quantity as fraction/mixed number
const formatQuantityAsFraction = (qty: number): string => {
  if (qty === 0) return '0';
  if (Number.isInteger(qty)) return qty.toString();

  const whole = Math.floor(qty);
  const fractional = qty - whole;

  // Common fractions with tolerance-based matching for floating point
  const commonFractions = [
    { value: 0.125, display: '1/8' },
    { value: 0.25, display: '1/4' },
    { value: 1 / 3, display: '1/3' },
    { value: 0.375, display: '3/8' },
    { value: 0.5, display: '1/2' },
    { value: 0.625, display: '5/8' },
    { value: 2 / 3, display: '2/3' },
    { value: 0.75, display: '3/4' },
    { value: 0.875, display: '7/8' },
  ];

  const tolerance = 0.02; // Allow small floating point differences
  const matchedFraction = commonFractions.find(
    f => Math.abs(fractional - f.value) < tolerance,
  );

  if (matchedFraction) {
    return whole === 0
      ? matchedFraction.display
      : `${whole} ${matchedFraction.display}`;
  }

  // Fall back to decimal with smart formatting
  const formatted = qty.toFixed(2).replace(/\.?0+$/, '');
  return formatted || '0';
};

// Helper to build stacked quantity + weight display
// Returns { qty, weight } where either can be null
const buildStackedDisplay = (
  qty: number,
  weight: number | null | undefined,
  weightUnit: string | null | undefined,
): { qtyDisplay: string | null; weightDisplay: string | null } => {
  const isOne = Math.abs(qty - 1) < 0.001;
  const hasWeight = weight != null && weight > 0 && weightUnit;

  // Quantity display: hide "1" for single items
  const qtyDisplay = isOne ? null : formatQuantityAsFraction(qty);

  // Weight display: show if available
  const weightDisplay = hasWeight ? `${weight} ${weightUnit}` : null;

  return { qtyDisplay, weightDisplay };
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
  subtitle?: React.JSX.Element | null;
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

      // Get urgent expiry info (only if expiring within 7 days or expired)
      const urgentTimeInfo = getUrgentTimeInfo(item);

      // Get image URL for the item
      const imageUrl = getItemImageUrl(item.item);

      // Use packageWeight if set (user override), otherwise fall back to catalog item weight
      const effectiveNetWeight = item.packageWeight ?? item.item?.netWeight;
      const effectiveWeightUnitSymbol = getEffectiveUnitSymbol(item);

      // Format storage state (Fridge/Freezer/Dry pantry) for right element
      const storageStateDisplay = formatStorageState(item.storageState);

      // Get user-defined storage location name (e.g., "Top shelf", "Pantry drawer")
      const storageLocationName = item.storageLocation?.name || null;

      // Build stacked quantity + weight display for right element
      const { qtyDisplay, weightDisplay } = buildStackedDisplay(
        item.currentQuantity,
        effectiveNetWeight,
        effectiveWeightUnitSymbol,
      );

      // Subtitle: show storage location and expiry warnings (no category - too cluttered)
      const buildSubtitle = () => {
        const lines: React.ReactNode[] = [];

        // Line 1: User storage location (if defined)
        if (storageLocationName) {
          lines.push(
            <Text
              key="location"
              style={{ color: theme.colors.textSecondary, fontSize: 14 }}
            >
              {storageLocationName}
            </Text>,
          );
        }

        // Line 2: Expiry warning with color
        if (urgentTimeInfo) {
          const expiryColor =
            urgentTimeInfo.color === 'error'
              ? theme.colors.error
              : theme.colors.warning;
          lines.push(
            <Text
              key="expiry"
              style={{ color: expiryColor, fontSize: 13, fontWeight: '500' }}
            >
              {urgentTimeInfo.text}
            </Text>,
          );
        }

        if (lines.length === 0) return null;

        return <View>{lines}</View>;
      };

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle: buildSubtitle(),
        rightElement: (
          <View style={{ alignItems: 'flex-end' }}>
            {/* Line 1: Quantity (hidden for single items) */}
            {qtyDisplay ? (
              <Text
                style={{
                  fontWeight: '600',
                  fontSize: 15,
                  color: theme.colors.textPrimary,
                }}
              >
                {qtyDisplay}
              </Text>
            ) : null}
            {/* Line 2: Weight */}
            {weightDisplay ? (
              <Text
                style={{
                  fontWeight: '400',
                  fontSize: 13,
                  color: theme.colors.textSecondary,
                  marginTop: qtyDisplay ? 1 : 0,
                }}
              >
                {weightDisplay}
              </Text>
            ) : null}
            {/* Line 3: Storage state - ONLY if no user-defined storage location */}
            {!storageLocationName && storageStateDisplay ? (
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  marginTop: qtyDisplay || weightDisplay ? 2 : 0,
                }}
              >
                {storageStateDisplay}
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
