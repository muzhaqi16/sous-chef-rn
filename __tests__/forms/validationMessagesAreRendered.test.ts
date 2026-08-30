import fs from 'fs';
import path from 'path';
import { ValidationError, type AnySchema } from 'yup';
import { shoppingItemSchema } from '#features/shoppingList/hooks/shoppingItemFormConfig';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
} from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import {
  addItemSchema,
  editItemSchema,
} from '#features/pantry/components/form/pantryItemFormConfig';

/**
 * Every validation message has a place on screen.
 *
 * `net-weight-needs-value` shipped able to fail with no consumer rendering
 * `errors.netWeight` anywhere: picking a weight unit without typing a weight
 * made Save refuse, `logValidationErrors` wrote a `logger.warn`, and the button
 * was dead with nothing on screen to explain it. In edit mode a stored row with
 * a unit and no weight could never be saved at all.
 *
 * CLAUDE.md: "A field the user can fix is reported ON the field, never through
 * `alertService.alert`." A field reported NOWHERE is strictly worse than either.
 * So this walks the real schemas, collects every field path that can carry a
 * message, and asserts the owning feature renders each one.
 */

const SRC = path.join(__dirname, '..', '..', 'src');

/** Every .tsx under `dir`, joined — the rendering surface for one feature. */
function featureSource(dir: string): string {
  const root = path.join(SRC, 'features', dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full);
      } else if (entry.name.endsWith('.tsx')) {
        out.push(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(root);
  return out.join('\n');
}

/** Field paths that carry a message for at least one of `inputs`. */
async function failingPaths(
  schema: AnySchema,
  inputs: Record<string, unknown>[],
): Promise<string[]> {
  const paths = new Set<string>();
  for (const input of inputs) {
    try {
      await schema.validate(input, { abortEarly: false });
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      for (const e of error.inner) if (e.path) paths.add(e.path);
    }
  }
  return [...paths];
}

/**
 * Whether `field` is rendered through a `Controller` that surfaces its own
 * `fieldState.error`.
 *
 * The `errors.<field>` accessor is one convention; a `Controller` whose render
 * reads `fieldState.error?.message` is the other, and it names the field only in
 * the `name` prop. Scoped to the render body that follows the name so a
 * `fieldState` elsewhere in the file cannot vouch for an unrendered field.
 */
function renderedThroughController(source: string, field: string): boolean {
  const marker = new RegExp(`name="${field}"(?![A-Za-z0-9_])`, 'gu');
  for (const match of source.matchAll(marker)) {
    const start = match.index ?? 0;
    if (source.slice(start, start + 800).includes('fieldState.error')) {
      return true;
    }
  }
  return false;
}

const pantryBase = addPantryItemDefaults('');

const CASES = [
  {
    name: 'shoppingItemSchema',
    schema: shoppingItemSchema as unknown as AnySchema,
    feature: 'shoppingList',
    // One input per rule, including both halves of the all-or-nothing pair.
    inputs: [
      {},
      { itemName: 'Milk', quantityInput: '1', netWeightUnitId: 'unit-1' },
      { itemName: 'Milk', quantityInput: '1', netWeight: '500' },
    ],
  },
  {
    name: 'addPantryItemSchema',
    schema: addPantryItemSchema as unknown as AnySchema,
    feature: 'pantry',
    inputs: [
      { ...pantryBase, itemName: '', quantityInput: '' },
      { ...pantryBase, itemName: 'Milk', pantryNetWeight: '500' },
      {
        ...pantryBase,
        itemName: 'Milk',
        quantityInput: '1',
        pantryNetWeightUnitId: 'unit-1',
      },
      // The package-details pair. Every case above leaves `showPackageDetails`
      // at its default of `false`, and both rules return early on that — so the
      // suite could not see two blocking rules with no consumer at all.
      {
        ...pantryBase,
        itemName: 'Milk',
        quantityInput: '1',
        showPackageDetails: true,
        itemNetWeight: '500',
      },
      {
        ...pantryBase,
        itemName: 'Milk',
        quantityInput: '1',
        showPackageDetails: true,
        weightUnitId: 'unit-1',
      },
    ],
  },
  {
    name: 'addItemSchema',
    schema: addItemSchema as unknown as AnySchema,
    feature: 'pantry',
    // The same all-or-nothing net-weight pair the add sheet enforces. The submit
    // path drops a weight with no resolved unit id, so a form that does not
    // refuse it discards what the user typed with nothing reported.
    inputs: [
      {},
      { quantityInput: '1', netWeight: '500' },
      { quantityInput: '1', netWeightUnitId: 'unit-1' },
    ],
  },
  {
    name: 'editItemSchema',
    schema: editItemSchema as unknown as AnySchema,
    feature: 'pantry',
    inputs: [
      {},
      { quantityInput: '1', netWeight: '500' },
      { quantityInput: '1', netWeightUnitId: 'unit-1' },
    ],
  },
] as const;

describe('validation messages have a rendering consumer', () => {
  const sources = new Map<string, string>();
  beforeAll(() => {
    for (const feature of new Set(CASES.map(c => c.feature))) {
      sources.set(feature, featureSource(feature));
    }
  });

  it.each(CASES.map(c => [c.name, c] as const))('%s', async (_name, testCase) => {
    const paths = await failingPaths(testCase.schema, [...testCase.inputs]);
    expect(paths.length).toBeGreaterThan(0);

    const source = sources.get(testCase.feature) ?? '';
    for (const field of paths) {
      // Two ways a form reports a field, and the guard has to see both. It used
      // to know only the first, so a field rendered the idiomatic
      // `Controller`/`fieldState` way read as having no consumer at all.
      //
      // `errors.netWeight` must not be satisfied by `errors.netWeightUnit`.
      const viaErrorsObject = new RegExp(
        `errors\\.${field}(?![A-Za-z0-9_])`,
        'u',
      ).test(source);
      const viaFieldState = renderedThroughController(source, field);
      const rendered = viaErrorsObject || viaFieldState;

      expect(
        rendered
          ? true
          : `${testCase.name}.${field} can fail but no ${testCase.feature} component renders errors.${field}`,
      ).toBe(true);
    }
  });
});
