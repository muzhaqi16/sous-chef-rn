import { defaultLocale, type AnySchema } from 'yup';
import { shoppingItemSchema } from '#features/shoppingList/hooks/shoppingItemFormConfig';
import { addPantryItemSchema } from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import { editItemSchema } from '#features/pantry/components/form/pantryItemFormConfig';
import { createItemSchema } from '#features/catalog/utils/itemValidation';

/**
 * A number rule with no message falls back to yup's English default, which
 * names the field by its internal path and reads the same in every locale
 * ("units[0].packageSize must be greater than or equal to 0.001"). Every rule
 * that can be rendered carries a message function; a rule that reaches a form
 * later — as the units rows did — must bring its message with it.
 */

interface RuleShape {
  type?: string;
  fields?: Record<string, unknown>;
  innerType?: unknown;
  tests?: Array<{ OPTIONS?: { name?: string; message?: unknown } }>;
  internalTests?: { typeError?: { OPTIONS?: { message?: unknown } } };
}

const DEFAULTS = new Set<unknown>([
  defaultLocale.number.min,
  defaultLocale.number.max,
  defaultLocale.number.moreThan,
  defaultLocale.number.lessThan,
  defaultLocale.number.positive,
  defaultLocale.number.integer,
  defaultLocale.mixed.notType,
]);

/**
 * Rules no typed text can reach. `priority` is written by a select, so its
 * type error has no keystroke to fire on and nothing renders it.
 */
const NEVER_TYPED = new Set(['shoppingItemSchema › priority: typeError']);

/** `<path>: <rule>` for every number rule still on a library default. */
function unmessagedNumberRules(schema: unknown, path = ''): string[] {
  const node = schema as RuleShape;
  const out: string[] = [];
  if (node.type === 'number') {
    for (const test of node.tests ?? []) {
      if (DEFAULTS.has(test.OPTIONS?.message)) {
        out.push(`${path}: ${test.OPTIONS?.name}`);
      }
    }
    const typeError = node.internalTests?.typeError?.OPTIONS?.message;
    if (typeError === undefined || DEFAULTS.has(typeError)) {
      out.push(`${path}: typeError`);
    }
  }
  for (const [name, field] of Object.entries(node.fields ?? {})) {
    out.push(...unmessagedNumberRules(field, path ? `${path}.${name}` : name));
  }
  if (node.innerType) {
    out.push(...unmessagedNumberRules(node.innerType, `${path}[]`));
  }
  return out;
}

describe.each<[string, AnySchema]>([
  ['createItemSchema', createItemSchema],
  ['shoppingItemSchema', shoppingItemSchema],
  ['addPantryItemSchema', addPantryItemSchema],
  ['editItemSchema', editItemSchema],
])('%s', (_name, schema) => {
  it('gives every number rule its own message', () => {
    expect(
      unmessagedNumberRules(schema).filter(
        rule => !NEVER_TYPED.has(`${_name} › ${rule}`),
      ),
    ).toEqual([]);
  });
});
