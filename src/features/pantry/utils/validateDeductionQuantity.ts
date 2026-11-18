import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
  resolveQuantityNotation,
  unitLabel,
} from '#/utils/formatQuantity';
import { inCountedUnit } from '#domain/stockDisplay';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';

function alertExceeds(
  actionVerb: 'consume' | 'waste',
  cap: ShownQuantity,
  report: (title: string, message: string) => void,
): void {
  const notation = resolveQuantityNotation(null, cap.displayAsFraction);
  report(
    t('labels.error'),
    t(
      actionVerb === 'waste'
        ? 'deduction.exceedsAvailableWaste'
        : 'deduction.exceedsAvailableConsume',
      {
        amount: formatQuantityForDisplay(cap.quantity, { notation }),
        unit: unitLabel(cap.unit, { quantity: cap.quantity, notation }),
      },
    ),
  );
}

/**
 * Validates a deduction quantity (consume or waste) against available stock.
 * Shows an alert on validation failure.
 *
 * @returns The parsed numeric value, or null if validation failed.
 */
export function validateDeductionQuantity(
  quantityInput: string,
  shared: PantryActionSharedState,
  actionVerb: 'consume' | 'waste',
  onError?: (message: string) => void,
): number | null {
  const report = (title: string, message: string) =>
    onError ? onError(message) : alertService.alert(title, message);
  const value = parseFractionalInput(quantityInput);
  if (value === null || isNaN(value) || value <= 0) {
    report(
      t('labels.error'),
      actionVerb === 'waste'
        ? t('deduction.invalidWaste')
        : t('errors.invalidQuantity'),
    );
    return null;
  }

  // The tracking unit or a dozen of it: checked in the tracking unit, and a
  // refusal names the cap as the stack shows it ("11 pc", not "0.917 doz").
  const factor = shared.exactFactor;
  if (factor !== null) {
    const cap = shared.trackingQuantity;
    const deduction = snapDeductionToCap(value, cap / factor);
    if (inCountedUnit(deduction, factor) > cap) {
      alertExceeds(actionVerb, shared.leftAfter(0), report);
      return null;
    }
    return deduction;
  }

  // Missing conversion evidence stays pending; never compare ounces with pounds
  // or cartons. A refused conversion leaves the stack's own unit usable.
  const cap =
    shared.availableInSelectedUnit ??
    (shared.activeUnitId === shared.trackingUnitId
      ? shared.trackingQuantity
      : null);
  if (cap === null) {
    if (!shared.conversionUnavailable) return value;
    report(t('labels.error'), t('deduction.conversionUnavailable'));
    return null;
  }

  const deduction = snapDeductionToCap(value, cap);
  if (deduction > cap) {
    alertExceeds(
      actionVerb,
      {
        quantity: cap,
        unit: shared.activeUnit,
        displayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
      },
      report,
    );
    return null;
  }

  return deduction;
}

/**
 * A deduction that READS as the cap is the cap. The seed's two notations
 * ("2.457" for 2.4566, "1/3" for 0.3338) are exact round trips and snap either
 * way; the display ("1 1/3" for 1.32) is ±0.02 wide, so it snaps only an amount
 * above the cap, never one below it.
 */
export function snapDeductionToCap(value: number, cap: number): number {
  const readsAsCap =
    value === cap ||
    formatQuantityForInput(value, { notation: 'decimal' }) ===
      formatQuantityForInput(cap, { notation: 'decimal' }) ||
    formatQuantityForInput(value) === formatQuantityForInput(cap) ||
    (value > cap &&
      formatQuantityForDisplay(value) === formatQuantityForDisplay(cap));
  return readsAsCap ? cap : value;
}
