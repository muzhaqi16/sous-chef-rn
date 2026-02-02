import React, { useMemo } from 'react';
import { View, Image, Text } from 'react-native';
import { getItemImageUrl } from '#utils/imageUtils';
import { commonStyles } from '#/styles/commonStyles';
import { StorageState } from '#generated';

// Location type for filtering
export type PantryLocation = 'fridge' | 'freezer' | 'pantry';

// Expiration status type for styling
export type ExpirationStatusType = 'expired' | 'critical' | 'warning' | 'normal';

export interface ExpirationStatus {
  text: string;
  type: ExpirationStatusType;
}

interface PantryItem {
  id: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  quantity: number;
  autoReorderPoint?: number | null;
  storageState?: string | null;
  storageLocation?: {
    id?: string;
    name?: string;
    type?: string;
  } | null;
  lowStockAlert?: boolean | null;
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

// Helper to calculate days until expiry (negative if expired)
export const calculateExpiresIn = (expiresAt?: string | null): number | null => {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// Helper to get location from storage state
export const getLocation = (storageState?: string | null): PantryLocation => {
  switch (storageState) {
    case StorageState.Refrigerated:
      return 'fridge';
    case StorageState.Frozen:
      return 'freezer';
    default:
      return 'pantry';
  }
};

// Helper to get expiration status
export const getExpirationStatus = (expiresIn: number | null): ExpirationStatus => {
  if (expiresIn === null) {
    return { text: 'No expiry date', type: 'normal' };
  }
  if (expiresIn < 0) {
    return { text: `Expired ${Math.abs(expiresIn)} days ago`, type: 'expired' };
  }
  if (expiresIn === 0) {
    return { text: 'Expires today!', type: 'critical' };
  }
  if (expiresIn === 1) {
    return { text: 'Expires tomorrow!', type: 'warning' };
  }
  if (expiresIn <= 3) {
    return { text: `Expires in ${expiresIn} days`, type: 'warning' };
  }
  return { text: `${expiresIn} days left`, type: 'normal' };
};

// Default category emojis
const CATEGORY_EMOJIS: Record<string, string> = {
  vegetables: '🥬',
  fruits: '🍎',
  meat: '🥩',
  poultry: '🍗',
  seafood: '🐟',
  dairy: '🥛',
  grains: '🌾',
  bakery: '🍞',
  beverages: '🥤',
  snacks: '🍿',
  condiments: '🧂',
  frozen: '❄️',
  prepared: '🍲',
  default: '📦',
};

// Helper to get emoji from category
export const getCategoryEmoji = (categoryName?: string | null): string => {
  if (!categoryName) return CATEGORY_EMOJIS.default;
  const lowerName = categoryName.toLowerCase();
  return CATEGORY_EMOJIS[lowerName] || CATEGORY_EMOJIS.default;
};

// Helper to format quantity for redesign display
export const formatQuantityDisplay = (quantity: number, unit?: string): string => {
  const unitStr = unit || '';
  if (quantity >= 1000 && (unitStr === 'g' || unitStr === 'ml')) {
    return `${(quantity / 1000).toFixed(1)}${unitStr === 'g' ? 'kg' : 'L'}`;
  }
  if (Number.isInteger(quantity)) {
    return `${quantity} ${unitStr}`.trim();
  }
  return `${quantity.toFixed(quantity < 10 ? 2 : 1)} ${unitStr}`.trim();
};

// Helper to format quantity as fraction/mixed number
const formatQuantityAsFraction = (qty: number): string => {
  if (qty == null) return '0';
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
  // New fields for redesign
  expiresIn: number | null;
  location: PantryLocation;
  emoji: string;
  expirationStatus: ExpirationStatus;
  quantity: number;
  unitSymbol?: string;
  storageStateDisplay: string;
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
    // Filter out items with missing or invalid IDs to prevent key warnings
    // This can happen during cache updates when items are being removed
    return items.filter(item => item.id).map(item => {
      // Calculate expired status for badge
      const isExpired =
        item.expiresAt && new Date(item.expiresAt) < new Date();

      // Get urgent expiry info (only if expiring within 7 days or expired)
      const urgentTimeInfo = getUrgentTimeInfo(item);

      // Get image URL for the item
      const imageUrl = getItemImageUrl(item.item);

      // Format storage state (Fridge/Freezer/Dry pantry) for right element
      const storageStateDisplay = formatStorageState(item.storageState);

      // Get user-defined storage location name (e.g., "Top shelf", "Pantry drawer")
      const storageLocationName = item.storageLocation?.name || null;

      // Format quantity for display
      const qtyDisplay = formatQuantityAsFraction(item.quantity);

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

      // Calculate new fields for redesign
      const expiresIn = calculateExpiresIn(item.expiresAt);
      const location = getLocation(item.storageState);
      const emoji = getCategoryEmoji((item as any).item?.category?.name);
      const expirationStatus = getExpirationStatus(expiresIn);

      return {
        id: item.id,
        title: item.item?.name || '',
        subtitle: buildSubtitle(),
        rightElement: (
          <View style={{ alignItems: 'flex-end' }}>
            {/* Line 1: Quantity */}
            <Text
              style={{
                fontWeight: '600',
                fontSize: 15,
                color: theme.colors.textPrimary,
              }}
            >
              {qtyDisplay} {item.unit?.symbol || ''}
            </Text>
            {/* Line 2: Storage state - ONLY if no user-defined storage location */}
            {!storageLocationName && storageStateDisplay ? (
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
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
        // New fields for redesign
        expiresIn,
        location,
        emoji,
        expirationStatus,
        quantity: item.quantity,
        unitSymbol: item.unit?.symbol,
        storageStateDisplay,
      };
    });
  }, [items, theme]);
}
