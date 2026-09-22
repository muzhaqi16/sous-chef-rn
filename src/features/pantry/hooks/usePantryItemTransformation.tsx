import type { StorageState } from '#/graphql/generated/schemaTypes';
import {
  type AcquisitionMethod,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';
import {
  acquisitionMethodLabelKey,
  conditionLabelKey,
} from '#features/pantry/utils/itemEnumLabels';
// Aliased: despite the `use` prefix this module exports plain functions, not a
// hook, so there is no component to call `useTranslation` in. Callers that
// render the result are responsible for re-running these on a language change.
import { isTranslationKey, t as tGlobal } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { daysUntilExpiry, expiryLabel } from '#domain/expiry';
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

/**
 * The short register for the detail screen ("Fridge", not "Refrigerated"); its
 * own namespace because `storageState.*` is the long form the pickers show. `t`
 * is a parameter — resolving at module load freezes the first-loaded language.
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
): ExpirationStatus => {
  if (expiresIn === null) {
    return { text: tGlobal('expiration.noExpiryDate'), type: 'normal' };
  }
  const text = expiryLabel(expiresIn, tGlobal);
  if (expiresIn < 0) return { text, type: 'expired' };
  if (expiresIn === 0) return { text, type: 'critical' };
  if (expiresIn <= 3) return { text, type: 'warning' };
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
): string | null => {
  if (!breakdown) return null;
  const unit =
    firstNonBlank(breakdown.contentUnit.symbol) ?? breakdown.contentUnit.name;
  const weightUnit = breakdown.perUnitNetWeightUnit?.symbol;
  if (breakdown.perUnitNetWeight && weightUnit) {
    return tGlobal('pantryItemCard.packageContents', {
      count: breakdown.count,
      weight: formatQuantityForDisplay(breakdown.perUnitNetWeight, {
        notation: 'decimal',
      }),
      weightUnit,
      unit,
    });
  }
  return tGlobal('itemSubtitle.contentUnitCount', {
    count: breakdown.count,
    unit,
  });
};

/** The package breakdown plus its total weight, for detail views. */
export const formatPackageBreakdownFull = (
  breakdown: PackageBreakdown | null | undefined,
): string | null => {
  const short = formatPackageBreakdown(breakdown);
  if (!breakdown || !short) return null;
  const weightUnit = breakdown.perUnitNetWeightUnit?.symbol;
  if (breakdown.totalNetWeight && weightUnit) {
    return tGlobal('pantryItemCard.packageWithTotal', {
      breakdown: short,
      total: formatQuantityForDisplay(breakdown.totalNetWeight, {
        notation: 'decimal',
      }),
      weightUnit,
    });
  }
  return short;
};

// Helper to format net weight for primary display (no "ea" suffix, with g→kg / ml→L upscaling)
export const formatNetWeightDisplay = (
  netWeight?: number | null,
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null,
): string | null => {
  if (!netWeight) return null;
  const unitStr =
    firstNonBlank(netWeightUnit?.symbol, netWeightUnit?.name) ?? '';

  // Same g→kg, mL→L upscaling as formatQuantityDisplay — and the same
  // case-insensitive match, the canonical symbol being `mL`.
  if (
    netWeight >= 1000 &&
    (unitStr === 'g' || unitStr.toLowerCase() === 'ml')
  ) {
    return `${(netWeight / 1000).toFixed(1)} ${unitStr === 'g' ? 'kg' : 'L'}`;
  }

  const formatted = Number.isInteger(netWeight)
    ? netWeight.toString()
    : netWeight.toFixed(netWeight < 10 ? 2 : 1).replace(/\.?0+$/, '');
  return `${formatted} ${unitStr}`.trim();
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
  // The unit label is server data (`Unit.symbol` / `Unit.name`) with no plural
  // form, so it passes through untouched — never append an English "s" to it.
  // The count/unit order lives in the key so a locale can change it.
  const contentLabel = firstNonBlank(
    breakdown.contentUnit?.symbol,
    breakdown.contentUnit?.name,
  );
  if (!contentLabel) return null;
  return tGlobal('itemSubtitle.contentUnitCount', {
    count: total,
    unit: contentLabel,
  });
};

// Helper function to calculate expiry info for detail views
export const getExpiryInfo = (
  expiresOn: string | null | undefined,
  now?: Date,
) => {
  if (!expiresOn) return null;
  const diffDays = daysUntilExpiry(expiresOn, now);
  return {
    text: expiryLabel(diffDays, tGlobal),
    isExpired: diffDays < 0,
    isUrgent: diffDays <= 3,
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

// A cost, or null when the server recorded none — callers omit the row rather
// than render an em dash beside populated ones. A cost recorded AS zero is a
// fact somebody entered (a gift, a comped line) and is shown. Distinct from
// `formatCurrency`, which always returns a string.
export const formatCostOrNull = (
  amount: number | null | undefined,
  currency: string,
): string | null => {
  if (amount == null) return null;
  return formatMoney(amount, currency);
};
