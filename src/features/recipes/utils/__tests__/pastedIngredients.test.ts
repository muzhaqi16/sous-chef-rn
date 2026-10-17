import {
  MAX_PASTED_LINE_LENGTH,
  capPastedText,
  pastedLines,
  toPastedIngredient,
} from '#features/recipes/utils/pastedIngredients';
import type { ParseIngredientLinesQuery } from '#features/recipes/hooks/useIngredientPaste.generated';

type ParsedLine =
  ParseIngredientLinesQuery['parseIngredientLines']['lines'][number];

describe('pastedLines', () => {
  it('takes one ingredient per non-blank line, trimmed', () => {
    expect(pastedLines('  2 cups flour \r\n\n salt, to taste\n   ')).toEqual([
      '2 cups flour',
      'salt, to taste',
    ]);
  });
});

describe('capPastedText', () => {
  it('holds no more ingredient lines than the recipe has room for', () => {
    const capped = capPastedText('a\nb\n\nc\nd\ne', 3);

    expect(pastedLines(capped)).toEqual(['a', 'b', 'c']);
  });

  it('cuts a line at the longest the parser reads', () => {
    const capped = capPastedText('x'.repeat(MAX_PASTED_LINE_LENGTH + 20), 5);

    expect(capped).toHaveLength(MAX_PASTED_LINE_LENGTH);
  });

  it('leaves text within the limits as typed', () => {
    expect(capPastedText('flour\n', 3)).toBe('flour\n');
  });
});

describe('toPastedIngredient', () => {
  const line: ParsedLine = {
    __typename: 'ParsedIngredientLine',
    originalText: '2 ½ cups all-purpose flour, sifted',
    name: 'all-purpose flour',
    quantity: 2.5,
    unit: {
      __typename: 'Unit',
      id: 'u-cup',
      name: 'cup',
      symbol: 'cup',
    },
    preparation: 'sifted',
    note: null,
    section: 'For the dough',
    isOptional: false,
    item: { __typename: 'Item', id: 'item-flour' },
  };

  it('keeps the line as written beside its parts', () => {
    expect(toPastedIngredient(line)).toEqual({
      name: 'all-purpose flour',
      quantity: 2.5,
      unitId: 'u-cup',
      unitLabel: 'cup',
      itemId: 'item-flour',
      preparation: 'sifted',
      notes: '',
      section: 'For the dough',
      isOptional: false,
      originalText: '2 ½ cups all-purpose flour, sifted',
    });
  });

  it('leaves a line stating no amount without one, and unlinked when unsure', () => {
    const row = toPastedIngredient({
      ...line,
      originalText: 'Salt, to taste',
      name: 'Salt',
      quantity: null,
      unit: null,
      preparation: 'to taste',
      item: null,
    });

    expect(row).toMatchObject({
      quantity: null,
      unitId: null,
      unitLabel: '',
      itemId: null,
    });
  });
});
