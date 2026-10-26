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
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import {
  currentReading,
  formatReading,
  readingNotation,
  type MeasureShape,
  type ReadingSystem,
} from '#domain/measure';

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

type BreakdownMeasure = MeasureShape & { value: number; unitId: string };

interface PackageBreakdown {
  count: number;
  contentUnit: { name: string; symbol?: string | null };
  perUnitNetWeight?: number | null;
  perUnitNetWeightUnit?: { id?: string; symbol?: string | null } | null;
  totalNetWeight?: number | null;
  /** `perUnitNetWeight` read in both unit systems. */
  perUnit?: BreakdownMeasure | null;
  /** `totalNetWeight` read in both unit systems. */
  total?: BreakdownMeasure | null;
}

/**
 * A breakdown weight in the user's system while its reading still describes
 * the stored figure, else as stored: only the server converts.
 */
function breakdownWeight(
  stored: number,
  unit: { id?: string; symbol?: string | null },
  measure: BreakdownMeasure | null | undefined,
  system: ReadingSystem | undefined,
): { weight: string; weightUnit: string | null | undefined } {
  const reading = system
    ? currentReading(measure, { value: stored, unitId: unit.id }, system)
    : null;
  return reading
    ? {
        weight: formatQuantityForDisplay(reading.value, {
          notation: readingNotation(reading),
        }),
        weightUnit: reading.symbol,
      }
    : {
        weight: formatQuantityForDisplay(stored, { notation: 'decimal' }),
        weightUnit: unit.symbol,
      };
}

interface HeldAmountSource {
  displayAmount: { quantity: number; unit: { id: string; symbol: string } };
  unit: { id: string; displayAsFraction: boolean };
  held: BreakdownMeasure;
}

/**
 * What a stack holds, as its row shows it ("1 doz" for 12 pc): in the user's
 * unit system while `held` still describes it; else as stored, in the stack
 * unit's own notation when shown in that unit.
 */
export function formatHeldAmount(
  item: HeldAmountSource,
  system: ReadingSystem,
): string {
  const shown = item.displayAmount;
  const reading = currentReading(
    item.held,
    { value: shown.quantity, unitId: shown.unit.id },
    system,
  );
  if (reading) return formatReading(reading);
  const inOwnUnit = shown.unit.id === item.unit.id;
  const quantity = formatQuantityForDisplay(shown.quantity, {
    notation: resolveQuantityNotation(
      null,
      inOwnUnit ? item.unit.displayAsFraction : null,
    ),
  });
  return `${quantity} ${shown.unit.symbol}`;
}

// Unit labels are server data with no plural form, so they pass through as-is.
export const formatPackageBreakdown = (
  breakdown: PackageBreakdown | null | undefined,
  translate: Translate,
  system?: ReadingSystem,
): string | null => {
  if (!breakdown) return null;
  const unit =
    firstNonBlank(breakdown.contentUnit.symbol) ?? breakdown.contentUnit.name;
  const storedUnit = breakdown.perUnitNetWeightUnit;
  if (breakdown.perUnitNetWeight && storedUnit?.symbol) {
    const { weight, weightUnit } = breakdownWeight(
      breakdown.perUnitNetWeight,
      storedUnit,
      breakdown.perUnit,
      system,
    );
    return translate('pantryItemCard.packageContents', {
      count: breakdown.count,
      weight,
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
  system?: ReadingSystem,
): string | null => {
  const short = formatPackageBreakdown(breakdown, translate, system);
  if (!breakdown || !short) return null;
  const storedUnit = breakdown.perUnitNetWeightUnit;
  if (breakdown.totalNetWeight && storedUnit?.symbol) {
    const { weight, weightUnit } = breakdownWeight(
      breakdown.totalNetWeight,
      storedUnit,
      breakdown.total,
      system,
    );
    return translate('pantryItemCard.packageWithTotal', {
      breakdown: short,
      total: weight,
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
