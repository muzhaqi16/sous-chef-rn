import type { PantryItemForm_PantryItemFragment } from './PantryItemForm.generated';

type Stack = Pick<
  PantryItemForm_PantryItemFragment,
  'quantity' | 'unit' | 'displayAmount' | 'displayUnit'
>;

/**
 * What the form edits: a stack of pieces shown in whole dozens edits as dozens
 * ("1 doz"), stated in the dozen; any other stack edits its own quantity in its
 * own unit.
 */
export function editedAmount(stack: Stack) {
  const shownIn = stack.displayUnit;
  if (shownIn && stack.displayAmount.unit.id === shownIn.id) {
    return {
      quantity: stack.displayAmount.quantity,
      unit: shownIn,
      statedIn: shownIn,
    };
  }
  return { quantity: stack.quantity, unit: stack.unit, statedIn: null };
}
