import type { ParseIngredientLinesQuery } from '#features/recipes/hooks/useIngredientPaste.generated';
import type { IngredientFormState } from '#features/recipes/types';
import { unitLabel } from '#/utils/formatQuantity';

/** The longest line `parseIngredientLines` reads. */
export const MAX_PASTED_LINE_LENGTH = 500;

type ParsedLine =
  ParseIngredientLinesQuery['parseIngredientLines']['lines'][number];

export type PastedIngredient = Omit<IngredientFormState, 'id' | 'sortOrder'>;

/** The ingredient lines in pasted text: one per non-blank line, trimmed. */
export function pastedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '');
}

/**
 * The text cut to what one paste may send: at most `room` ingredient lines,
 * each at most `MAX_PASTED_LINE_LENGTH`. Applied as the text changes, so the
 * field never holds a line that would be left out.
 */
export function capPastedText(text: string, room: number): string {
  const kept: string[] = [];
  let ingredients = 0;
  for (const line of text.split(/\r?\n/)) {
    const isIngredient = line.trim() !== '';
    if (isIngredient && ingredients === room) break;
    if (isIngredient) ingredients += 1;
    kept.push(line.slice(0, MAX_PASTED_LINE_LENGTH));
  }
  return kept.join('\n');
}

/** A parsed line as a form row, keeping the line as written. */
export function toPastedIngredient(line: ParsedLine): PastedIngredient {
  return {
    name: line.name,
    quantity: line.quantity,
    unitId: line.unit?.id ?? null,
    unitLabel: unitLabel(line.unit),
    itemId: line.item?.id ?? null,
    preparation: line.preparation ?? '',
    notes: line.note ?? '',
    section: line.section ?? '',
    isOptional: line.isOptional,
    originalText: line.originalText,
  };
}
