import React from 'react';
import { View, Text } from 'react-native';
import { resolveImageUrl } from '#utils/imageUtils';
import { commonStyles } from '#/styles/commonStyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { StorageState, PantryItem } from '#generated';
import { fonts } from '#/theme/foundations/typography';
import { formatQuantityAsFraction } from '#/utils/formatQuantity';

// Location type for filtering
export type PantryLocation = 'fridge' | 'freezer' | 'pantry';

// Expiration status type for styling
export type ExpirationStatusType = 'expired' | 'critical' | 'warning' | 'normal';

export interface ExpirationStatus {
  text: string;
  type: ExpirationStatusType;
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
export const formatStorageState = (state?: string | null): string => {
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

// Helper to format package breakdown for display
export const formatPackageBreakdown = (
  breakdown: {
    count: number;
    contentUnit: { name: string; symbol?: string | null };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { symbol?: string | null } | null;
    totalNetWeight?: number | null;
  } | null | undefined,
  remainingContentUnits?: number | null,
): string | null => {
  if (!breakdown) return null;
  const displayCount = remainingContentUnits ?? breakdown.count;
  const contentDisplay = breakdown.contentUnit.symbol || breakdown.contentUnit.name;
  if (breakdown.perUnitNetWeight && breakdown.perUnitNetWeightUnit?.symbol) {
    return `${displayCount} x ${breakdown.perUnitNetWeight} ${breakdown.perUnitNetWeightUnit.symbol} ${contentDisplay}`;
  }
  return `${displayCount} ${contentDisplay}`;
};

// Helper to format full package breakdown with total for detail views
export const formatPackageBreakdownFull = (
  breakdown: {
    count: number;
    contentUnit: { name: string; symbol?: string | null };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { symbol?: string | null } | null;
    totalNetWeight?: number | null;
  } | null | undefined,
): string | null => {
  if (!breakdown) return null;
  const short = formatPackageBreakdown(breakdown);
  if (!short) return null;
  if (breakdown.totalNetWeight && breakdown.perUnitNetWeightUnit?.symbol) {
    return `${short} (${breakdown.totalNetWeight} ${breakdown.perUnitNetWeightUnit.symbol} total)`;
  }
  return short;
};

// Helper to format net weight for display (e.g., "14.5 oz ea")
export const formatNetWeight = (
  netWeight?: number | null,
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null,
): string | null => {
  if (!netWeight) return null;
  const unitStr = netWeightUnit?.symbol || netWeightUnit?.name || '';
  return `${netWeight}${unitStr} ea`;
};

// Helper to format net weight for primary display (no "ea" suffix, with g→kg / ml→L upscaling)
export const formatNetWeightDisplay = (
  netWeight?: number | null,
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null,
): string | null => {
  if (!netWeight) return null;
  const unitStr = netWeightUnit?.symbol || netWeightUnit?.name || '';

  // Same g→kg, ml→L upscaling as formatQuantityDisplay
  if (netWeight >= 1000 && (unitStr === 'g' || unitStr === 'ml')) {
    return `${(netWeight / 1000).toFixed(1)} ${unitStr === 'g' ? 'kg' : 'L'}`;
  }

  const formatted = Number.isInteger(netWeight)
    ? netWeight.toString()
    : netWeight.toFixed(netWeight < 10 ? 2 : 1).replace(/\.?0+$/, '');
  return `${formatted} ${unitStr}`.trim();
};

// Helper to format remaining net weight for display (e.g., "25 oz remaining")
export const formatRemainingNetWeight = (
  remainingNetWeight?: number | null,
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null,
): string | null => {
  if (remainingNetWeight == null) return null;
  const unitStr = netWeightUnit?.symbol || netWeightUnit?.name || '';
  const formatted = Number.isInteger(remainingNetWeight)
    ? remainingNetWeight.toString()
    : remainingNetWeight.toFixed(remainingNetWeight < 10 ? 2 : 1).replace(/\.?0+$/, '');
  return `${formatted} ${unitStr} remaining`.trim();
};

// Helper to format live quantity breakdown (e.g., "1 full case + 9 loose cans")
export const formatQuantityBreakdown = (
  breakdown: {
    fullPackages: number;
    looseContentUnits: number;
    contentUnit?: { name?: string; symbol?: string | null } | null;
    totalContentUnits: number;
    remainingWeight?: number | null;
    remainingWeightUnit?: { symbol?: string | null } | null;
  } | null | undefined,
): string | null => {
  if (!breakdown) return null;
  const total = Math.floor(breakdown.totalContentUnits);
  if (total <= 0) return null;
  const contentLabel = breakdown.contentUnit?.symbol || breakdown.contentUnit?.name || 'unit';
  return `${total} ${contentLabel}${total !== 1 ? 's' : ''}`;
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
  packageBreakdownText?: string | null;
  netWeightText?: string | null;
  remainingNetWeightText?: string | null;
  quantityBreakdownText?: string | null;
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

  // Filter out items with missing or invalid IDs to prevent key warnings
  // This can happen during cache updates when items are being removed
  return items.filter(item => item.id).map(item => {
      // Calculate expired status for badge
      const isExpired =
        item.expiresAt && new Date(item.expiresAt) < new Date();

      // Get urgent expiry info (only if expiring within 7 days or expired)
      const urgentTimeInfo = getUrgentTimeInfo(item);

      // Get image URL for the item
      const imageUrl = resolveImageUrl(item);

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
              style={{ color: theme.colors.textSecondary, fontSize: fonts.size.sm }}
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
              style={{ color: expiryColor, fontSize: 13, fontWeight: fonts.weight.medium }}
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
      const packageBreakdownText = formatPackageBreakdown(item.packageBreakdown);
      const netWeightText = formatNetWeight(item.netWeight, item.netWeightUnit);
      const remainingNetWeightText = formatRemainingNetWeight(item.remainingNetWeight, item.netWeightUnit);
      const quantityBreakdownText = formatQuantityBreakdown(item.quantityBreakdown);

      return {
        id: item.id,
        title: item.itemName || '',
        subtitle: buildSubtitle(),
        rightElement: (
          <View style={{ alignItems: 'flex-end' }}>
            {/* Line 1: Quantity */}
            <Text
              style={{
                fontWeight: fonts.weight.semibold,
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
                  fontSize: fonts.size.xs,
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
            <CachedImage
              uri={imageUrl}
              style={commonStyles.listItemImage}
              resizeMode="contain"
              displaySize={60}
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
        packageBreakdownText,
        netWeightText,
        remainingNetWeightText,
        quantityBreakdownText,
    };
  });
}
