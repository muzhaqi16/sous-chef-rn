import { StorageState } from '#/graphql/generated/schemaTypes';
// Aliased: despite the `use` prefix this module exports plain functions, not a
// hook, so there is no component to call `useTranslation` in. Callers that
// render the result are responsible for re-running these on a language change.
import { t as tGlobal } from '#/i18n';
import type { Translate } from '#/i18n/types';
// Plural keys need the options form, which the module-level t does not take.
import { getI18n } from '#/i18n/config';
import {
  DEFAULT_CURRENCY,
  formatCurrency as formatMoney,
} from '#/utils/formatters/number';

// Location type for filtering
export type PantryLocation = 'fridge' | 'freezer' | 'pantry';

// Expiration status type for styling
export type ExpirationStatusType =
  | 'expired'
  | 'critical'
  | 'warning'
  | 'normal';

export interface ExpirationStatus {
  text: string;
  type: ExpirationStatusType;
}

/**
 * The short register used on the item detail screen ("Fridge", not
 * "Refrigerated"), so it reads as a location rather than a setting. Kept as its
 * own namespace rather than reusing `storageState.*`, which is the long form
 * the pickers show.
 *
 * `t` is a parameter because resolving at module load would freeze whatever
 * language happened to load first.
 */
export const formatStorageState = (
  state: string | null | undefined,
  translate: Translate,
): string => (state ? translate(`storageStateShort.${state}`, state) : '');

// Helper to calculate days until expiry (negative if expired)
export const calculateExpiresIn = (
  expiresAt?: string | null,
): number | null => {
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
export const getExpirationStatus = (
  expiresIn: number | null,
): ExpirationStatus => {
  if (expiresIn === null) {
    return { text: tGlobal('expiration.noExpiryDate'), type: 'normal' };
  }
  if (expiresIn < 0) {
    return {
      text: getI18n().t('expiration.expiredDaysAgo', {
        count: Math.abs(expiresIn),
      }),
      type: 'expired',
    };
  }
  if (expiresIn === 0) {
    return { text: tGlobal('expiration.expiresToday'), type: 'critical' };
  }
  if (expiresIn === 1) {
    return { text: tGlobal('expiration.expiresTomorrow'), type: 'warning' };
  }
  if (expiresIn <= 3) {
    return {
      text: getI18n().t('expiration.expiresInDays', { count: expiresIn }),
      type: 'warning',
    };
  }
  return {
    text: getI18n().t('expiration.daysLeft', { count: expiresIn }),
    type: 'normal',
  };
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
  breakdown:
    | {
        count: number;
        contentUnit: { name: string; symbol?: string | null };
        perUnitNetWeight?: number | null;
        perUnitNetWeightUnit?: { symbol?: string | null } | null;
        totalNetWeight?: number | null;
      }
    | null
    | undefined,
  remainingContentUnits?: number | null,
): string | null => {
  if (!breakdown) return null;
  const displayCount = remainingContentUnits ?? breakdown.count;
  const contentDisplay =
    breakdown.contentUnit.symbol || breakdown.contentUnit.name;
  if (breakdown.perUnitNetWeight && breakdown.perUnitNetWeightUnit?.symbol) {
    return `${displayCount} x ${breakdown.perUnitNetWeight} ${breakdown.perUnitNetWeightUnit.symbol} ${contentDisplay}`;
  }
  return `${displayCount} ${contentDisplay}`;
};

// Helper to format full package breakdown with total for detail views
export const formatPackageBreakdownFull = (
  breakdown:
    | {
        count: number;
        contentUnit: { name: string; symbol?: string | null };
        perUnitNetWeight?: number | null;
        perUnitNetWeightUnit?: { symbol?: string | null } | null;
        totalNetWeight?: number | null;
      }
    | null
    | undefined,
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
    : remainingNetWeight
        .toFixed(remainingNetWeight < 10 ? 2 : 1)
        .replace(/\.?0+$/, '');
  return `${formatted} ${unitStr} remaining`.trim();
};

// Helper to format live quantity breakdown (e.g., "1 full case + 9 loose cans")
export const formatQuantityBreakdown = (
  breakdown:
    | {
        fullPackages: number;
        looseContentUnits: number;
        contentUnit?: { name?: string; symbol?: string | null } | null;
        totalContentUnits: number;
        remainingWeight?: number | null;
        remainingWeightUnit?: { symbol?: string | null } | null;
      }
    | null
    | undefined,
): string | null => {
  if (!breakdown) return null;
  const total = Math.floor(breakdown.totalContentUnits);
  if (total <= 0) return null;
  // The unit label is server data (`Unit.symbol` / `Unit.name`) and carries no
  // plural form, so it is passed through untouched. This used to append a
  // literal "s" for any count but 1 — English pluralisation applied to a label
  // that is not English, producing "2 lattinas" in Italian and "2 kgs" even in
  // English. The count/unit order lives in the key so a locale can change it.
  const contentLabel =
    breakdown.contentUnit?.symbol || breakdown.contentUnit?.name;
  if (!contentLabel) return null;
  return tGlobal('itemSubtitle.contentUnitCount', {
    count: total,
    unit: contentLabel,
  });
};

// Helper function to calculate expiry info for detail views
export const getExpiryInfo = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0)
    return {
      text: tGlobal('expiration.expired'),
      isExpired: true,
      isUrgent: true,
    };
  if (diffDays === 0)
    return {
      text: tGlobal('labels.expiresToday'),
      isExpired: false,
      isUrgent: true,
    };
  return {
    text: getI18n().t('expiration.daysToExpire', { count: diffDays }),
    isExpired: false,
    isUrgent: diffDays <= 3,
  };
};

// Format date for display
export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Device locale, not a hardcoded 'en-US': the day/month order and month
  // names have to match the rest of the UI.
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Calculate days in pantry
export const getDaysInPantry = (createdAt: string | null | undefined) => {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
};

// Format days in pantry for display
export const formatDaysInPantry = (days: number | null): string => {
  if (days === null) return '-';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
};

// Format condition enum for display
export const formatCondition = (condition?: string | null): string | null => {
  if (!condition || condition === 'GOOD') return null;
  return condition.charAt(0) + condition.slice(1).toLowerCase();
};

// Format acquisition method enum for display
export const formatAcquisitionMethod = (
  method?: string | null,
): string | null => {
  if (!method) return null;
  return method
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

// Format a money amount for display, or null when there is no amount worth
// showing — callers omit the row entirely rather than render a bare zero.
export const formatCurrency = (amount?: number | null): string | null => {
  if (amount == null || amount <= 0) return null;
  return formatMoney(amount, DEFAULT_CURRENCY);
};
