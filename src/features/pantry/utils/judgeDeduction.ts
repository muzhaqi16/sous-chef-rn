import { string } from 'yup';
import { t } from '#i18n';
import { parseFractionalInput } from '#utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
  resolveQuantityNotation,
  unitLabel,
} from '#utils/formatQuantity';
import { inCountedUnit } from '#entities/pantryItem/stockDisplay';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';

/** A quantity as its stack shows it: its amount and unit, in its notation. */
export const shownParts = ({
  quantity,
  unit,
  displayAsFraction,
}: ShownQuantity): { amount: string; unit: string } => {
  const notation = resolveQuantityNotation(displayAsFraction);
  return {
    amount: formatQuantityForDisplay(quantity, { notation }),
    unit: unitLabel(unit, { quantity, notation }),
  };
};

function exceeds(
  actionVerb: DeductionVerb,
  cap: ShownQuantity,
): DeductionJudgement {
  return {
    ok: false,
    message: t(
      actionVerb === 'waste'
        ? 'deduction.exceedsAvailableWaste'
        : 'deduction.exceedsAvailableConsume',
      shownParts(cap),
    ),
  };
}

type DeductionVerb = 'consume' | 'waste';

/** The amount a deduction takes, or why the stock cannot give it. */
type DeductionJudgement =
  | { ok: true; amount: number }
  | { ok: false; message: string };

/**
 * A deduction (a use or a waste) held to the stock. The form's schema reports a
 * refusal on the amount field (`heldToStock`); the submit reads the amount.
 */
export function judgeDeduction(
  quantityInput: string,
  shared: PantryActionSharedState,
  actionVerb: DeductionVerb,
): DeductionJudgement {
  const value = parseFractionalInput(quantityInput);
  if (value === null || isNaN(value) || value <= 0) {
    return {
      ok: false,
      message:
        actionVerb === 'waste'
          ? t('deduction.invalidWaste')
          : t('errors.invalidQuantity'),
    };
  }

  // The tracking unit or a dozen of it: checked in the tracking unit, and a
  // refusal names the cap as the stack shows it ("11 pc", not "0.917 doz").
  const factor = shared.exactFactor;
  if (factor !== null) {
    const cap = shared.trackingQuantity;
    const deduction = snapDeductionToCap(value, cap / factor);
    return inCountedUnit(deduction, factor) > cap
      ? exceeds(actionVerb, shared.leftAfter(0))
      : { ok: true, amount: deduction };
  }

  // Missing conversion evidence stays pending; never compare ounces with pounds
  // or cartons. A refused conversion leaves the stack's own unit usable.
  const cap =
    shared.availableInSelectedUnit ??
    (shared.activeUnitId === shared.trackingUnitId
      ? shared.trackingQuantity
      : null);
  if (cap === null) {
    return shared.conversionUnavailable
      ? { ok: false, message: t('deduction.conversionUnavailable') }
      : { ok: true, amount: value };
  }

  const deduction = snapDeductionToCap(value, cap);
  return deduction > cap
    ? exceeds(actionVerb, {
        quantity: cap,
        unit: shared.activeUnit,
        displayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
      })
    : { ok: true, amount: deduction };
}

/** Everything held, in the selected unit; null until a conversion says. */
export const allHeld = (shared: PantryActionSharedState): number | null =>
  shared.exactFactor != null
    ? shared.trackingQuantity / shared.exactFactor
    : shared.availableInSelectedUnit;

/** What a deduction schema reads beyond the form (`useForm`'s `context`). */
interface DeductionFormContext {
  shared: PantryActionSharedState;
}

/**
 * A deduction's amount field: what was typed, else `untyped`, held to the
 * stock the form's `context` carries.
 */
export const heldToStock = (
  actionVerb: DeductionVerb,
  untyped: (shared: PantryActionSharedState) => string,
) =>
  string()
    .nullable()
    .defined()
    .test('held-to-stock', (value, { options, createError }) => {
      const context: Partial<DeductionFormContext> | undefined =
        options.context;
      const shared = context?.shared;
      if (!shared) return true;
      const judged = judgeDeduction(
        value ?? untyped(shared),
        shared,
        actionVerb,
      );
      return judged.ok || createError({ message: judged.message });
    });

/** Changes whenever what a deduction is held to does, to check it again. */
export const deductionCap = (shared: PantryActionSharedState): string =>
  [
    shared.exactFactor,
    shared.trackingQuantity,
    shared.availableInSelectedUnit,
    shared.activeUnitId,
    shared.conversionUnavailable,
  ].join('|');

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
