import type { StorageState } from '#/graphql/generated/schemaTypes';
import {
  type AcquisitionMethod,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';
import {
  acquisitionMethodLabelKey,
  conditionLabelKey,
} from '#features/pantry/utils/itemEnumLabels';
import { isTranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import {
  daysUntilExpiry,
  EXPIRING_SOON_DAYS,
  expiryLabel,
} from '#domain/expiry';
import { formatCurrency as formatMoney } from '#/utils/formatters/number';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';

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

// Every helper here takes the caller's `t`. A compiled component re-runs a
// helper only when an argument changes, so one that reached for the module's
// own `t` would keep the language the row first rendered in.

/**
 * The short register for the detail screen ("Fridge", not "Refrigerated"); its
 * own namespace because `storageState.*` is the long form the pickers show.
 */
export const formatStorageState = (
  state: StorageState | null | undefined,
  translate: Translate,
): string => {
  if (!state) return '';
  // `string`: the wire can carry a member the generated enum predates.
  const key: string = `storageStateShort.${state}`;
  return isTranslationKey(key) ? translate(key) : translate('labels.unknown');
};

// Helper to get expiration status
export const getExpirationStatus = (
  expiresIn: number | null,
  translate: Translate,
): ExpirationStatus => {
  if (expiresIn === null) {
    return { text: translate('expiration.noExpiryDate'), type: 'normal' };
  }
  const text = expiryLabel(expiresIn, translate);
  if (expiresIn < 0) return { text, type: 'expired' };
  if (expiresIn === 0) return { text, type: 'critical' };
  if (expiresIn <= EXPIRING_SOON_DAYS) return { text, type: 'warning' };
  return { text, type: 'normal' };
};

interface PackageBreakdown {
  count: number;
  contentUnit: { name: string; symbol?: string | null };
  perUnitNetWeight?: number | null;
  perUnitNetWeightUnit?: { symbol?: string | null } | null;
  totalNetWeight?: number | null;
}

// Unit labels are server data with no plural form, so they pass through as-is.
export const formatPackageBreakdown = (
  breakdown: PackageBreakdown | null | undefined,
  translate: Translate,
): string | null => {
  if (!breakdown) return null;
  const unit =
    firstNonBlank(breakdown.contentUnit.symbol) ?? breakdown.contentUnit.name;
  const weightUnit = breakdown.perUnitNetWeightUnit?.symbol;
  if (breakdown.perUnitNetWeight && weightUnit) {
    return translate('pantryItemCard.packageContents', {
      count: breakdown.count,
      weight: formatQuantityForDisplay(breakdown.perUnitNetWeight, {
        notation: 'decimal',
      }),
      weightUnit,
      unit,
    });
  }
  return translate('itemSubtitle.contentUnitCount', {
    count: breakdown.count,
    unit,
  });
};

/** The package breakdown plus its total weight, for detail views. */
export const formatPackageBreakdownFull = (
  breakdown: PackageBreakdown | null | undefined,
  translate: Translate,
): string | null => {
  const short = formatPackageBreakdown(breakdown, translate);
  if (!breakdown || !short) return null;
  const weightUnit = breakdown.perUnitNetWeightUnit?.symbol;
  if (breakdown.totalNetWeight && weightUnit) {
    return translate('pantryItemCard.packageWithTotal', {
      breakdown: short,
      total: formatQuantityForDisplay(breakdown.totalNetWeight, {
        notation: 'decimal',
      }),
      weightUnit,
    });
  }
  return short;
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
  translate: Translate,
): string | null => {
  if (!breakdown) return null;
  const total = Math.floor(breakdown.totalContentUnits);
  if (total <= 0) return null;
  // The unit label is server data (`Unit.symbol` / `Unit.name`) with no plural
  // form, so it passes through untouched — never append an English "s" to it.
  // The count/unit order lives in the key so a locale can change it.
  const contentLabel = firstNonBlank(
    breakdown.contentUnit?.symbol,
    breakdown.contentUnit?.name,
  );
  if (!contentLabel) return null;
  return translate('itemSubtitle.contentUnitCount', {
    count: total,
    unit: contentLabel,
  });
};

// Helper function to calculate expiry info for detail views
export const getExpiryInfo = (
  expiresOn: string | null | undefined,
  today: string,
  translate: Translate,
) => {
  if (!expiresOn) return null;
  const diffDays = daysUntilExpiry(expiresOn, today);
  return {
    text: expiryLabel(diffDays, translate),
    isExpired: diffDays < 0,
    isUrgent: diffDays <= EXPIRING_SOON_DAYS,
  };
};

// Format date for display
export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Device locale, not a hardcoded 'en-US': the day/month order and month
  // names have to match the rest of the UI.
  return formatMonthDayYear(date);
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

export const formatDaysInPantry = (
  days: number | null,
  t: Translate,
): string => {
  if (days === null) return '-';
  if (days === 0) return t('labels.today');
  return t('labels.durationDays', { count: days });
};

/** Null for `GOOD`: the detail screen shows a condition only when it is a concern. */
export const formatCondition = (
  condition: ItemCondition | null | undefined,
  t: Translate,
): string | null => {
  if (!condition || condition === ItemCondition.Good) return null;
  return t(conditionLabelKey(condition));
};

export const formatAcquisitionMethod = (
  method: AcquisitionMethod | null | undefined,
  t: Translate,
): string | null => (method ? t(acquisitionMethodLabelKey(method)) : null);

// A cost, or null when none was recorded, so callers omit the row instead of an
// em dash. A cost recorded AS zero is a fact (a gift) and is shown.
// `formatCurrency` always returns a string.
export const formatCostOrNull = (
  amount: number | null | undefined,
  currency: string,
): string | null => {
  if (amount == null) return null;
  return formatMoney(amount, currency);
};
