import fs from 'fs';
import path from 'path';
import { ValidationError, type AnySchema } from 'yup';
import { shoppingItemSchema } from '#features/shoppingList/hooks/shoppingItemFormConfig';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
} from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import { editItemSchema } from '#features/pantry/components/form/pantryItemFormConfig';
import { createItemSchema } from '#features/catalog/utils/itemValidation';

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
    name: 'createItemSchema',
    schema: createItemSchema as unknown as AnySchema,
    feature: 'catalog',
    // The entry lists are the form's `netWeights` / `units` fields. They were
    // held in component state and merged only at submit, so these rules could
    // not fire and nothing rendered their message.
    inputs: [
      { name: 'Rice', netWeights: [{ value: NaN, unitName: '' }] },
      { name: 'Rice', netWeights: [{ value: 0, unitName: 'kg' }] },
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

  it.each(CASES.map(c => [c.name, c] as const))(
    '%s',
    async (_name, testCase) => {
      const paths = await failingPaths(testCase.schema, [...testCase.inputs]);
      expect(paths.length).toBeGreaterThan(0);

      const source = sources.get(testCase.feature) ?? '';
      for (const field of paths) {
        // Two ways a form reports a field, and the guard has to see both. It used
        // to know only the first, so a field rendered the idiomatic
        // `Controller`/`fieldState` way read as having no consumer at all.
        //
        // `errors.netWeight` must not be satisfied by `errors.netWeightUnit`.
        // `netWeights[0].value` is reported by whatever renders `netWeights`:
        // the row index stops addressing an editor row once empty rows drop out.
        const root = field.split(/[.[]/)[0] ?? field;
        const viaErrorsObject = new RegExp(
          `errors\\.${root}(?![A-Za-z0-9_])`,
          'u',
        ).test(source);
        const viaFieldState = renderedThroughController(source, root);
        const rendered = viaErrorsObject || viaFieldState;

        expect(
          rendered
            ? true
            : `${testCase.name}.${field} can fail but no ${testCase.feature} component renders errors.${field}`,
        ).toBe(true);
      }
    },
  );
});

/**
 * A cross-field rule is re-run by the form that resolves it.
 *
 * react-hook-form runs the whole schema on a change but writes back only
 * `errors[name]`, and `setValue(f, v, { shouldValidate: true })` triggers only
 * `f`. So a rule whose message lands on a DIFFERENT field than the one edited
 * needs an explicit `trigger([...])` — or, where a `Controller` owns the write,
 * a `deps` array, which react-hook-form turns into the same `trigger` call.
 *
 * Edit Pantry Item shipped without one and with the unit id it reads held in
 * `useState`, so "Please select a unit" could never clear. `check-form-state`
 * cannot see that: it exempts any file calling `useForm`.
 */

/** Every `.ts` under `dir`, recursively, skipping tests and generated code. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'generated') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

interface CrossFieldRule {
  /** The field the message lands on. */
  reporter: string;
  /** The sibling fields the rule reads. */
  reads: string[];
}

/** The three spellings a rule uses to read a sibling. */
const READ_PATTERNS = [
  /context\.parent\.([A-Za-z0-9_]+)/g,
  /\.when\(\s*'([A-Za-z0-9_]+)'/g,
  /\bref\(\s*'([A-Za-z0-9_]+)'\s*\)/g,
];

/** Cross-field rules per exported schema in one module. */
function crossFieldRules(source: string): Map<string, CrossFieldRule[]> {
  const bySchema = new Map<string, CrossFieldRule[]>();
  const declaration =
    /export const ([A-Za-z0-9_]+)(?::[^=]+)?\s*=\s*(?:object\(\{|[A-Za-z0-9_.]+\.shape\(\{)/g;
  const declarations = [...source.matchAll(declaration)];

  declarations.forEach((match, index) => {
    const start = match.index ?? 0;
    const end = declarations[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    // A field of the schema: one key at the object's own indent level.
    const keys = [...block.matchAll(/^ {2}([A-Za-z0-9_]+):/gm)];

    const rules = new Map<string, Set<string>>();
    for (const pattern of READ_PATTERNS) {
      for (const read of block.matchAll(pattern)) {
        const at = read.index ?? 0;
        const owner = keys.filter(k => (k.index ?? 0) < at).pop()?.[1];
        const field = read[1];
        if (!owner || !field || owner === field) continue;
        const reads = rules.get(owner) ?? new Set<string>();
        reads.add(field);
        rules.set(owner, reads);
      }
    }
    if (rules.size > 0) {
      bySchema.set(
        match[1] as string,
        [...rules].map(([reporter, reads]) => ({
          reporter,
          reads: [...reads],
        })),
      );
    }
  });
  return bySchema;
}

/**
 * The ONE form file that resolves each schema carrying a cross-field rule.
 * Per file, not per feature: a sibling form rendering the same field name used
 * to vouch for one that did not.
 */
const FORM_OWNERS: Record<string, string> = {
  editItemSchema: 'src/features/pantry/components/form/PantryItemForm.tsx',
  addPantryItemSchema:
    'src/features/pantry/components/modals/AddToPantrySheet/AddDetailsSheet.tsx',
  shoppingItemSchema:
    'src/features/shoppingList/hooks/useShoppingListItemForm.ts',
  moveToPantrySchema:
    'src/features/shoppingList/components/moveToPantry/MoveToPantryModal.tsx',
  signUpSchema: 'src/features/auth/screens/SignUpScreen.tsx',
  resetPasswordSchema: 'src/features/auth/screens/ResetPasswordScreen.tsx',
  changePasswordSchema: 'src/features/profile/screens/ChangePasswordScreen.tsx',
};

describe('cross-field rules are re-run by their form', () => {
  const schemas = new Map<string, CrossFieldRule[]>();
  beforeAll(() => {
    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('= object({')) continue;
      for (const [name, rules] of crossFieldRules(source)) {
        schemas.set(name, rules);
      }
    }
  });

  // Derived from the tree, so a new cross-field schema cannot ship unowned.
  it('every schema with a cross-field rule names its form', () => {
    expect(schemas.size).toBeGreaterThan(0);
    const unowned = [...schemas.keys()].filter(name => !FORM_OWNERS[name]);
    expect(unowned).toEqual([]);
  });

  it.each(Object.entries(FORM_OWNERS))('%s', (schema, owner) => {
    const rules = schemas.get(schema);
    expect(rules).toBeDefined();
    const source = fs.readFileSync(path.join(SRC, '..', owner), 'utf8');

    for (const { reporter, reads } of rules ?? []) {
      for (const field of reads) {
        // 1. Nothing shadows a schema field. The pantry bug: the unit id the
        //    rule reads lived in `useState`, so it never reached the resolver.
        const shadowed = new RegExp(
          `useState[^\\n]*\\n?[^\\n]*\\b${field}\\b[^\\n]*=\\s*useState|\\[\\s*${field}\\s*,[^\\]]*\\]\\s*=\\s*useState`,
          'u',
        ).test(source);
        expect(
          `${owner}: ${shadowed ? `${field} is held in useState` : 'ok'}`,
        ).toBe(`${owner}: ok`);

        // 2. The form names the field, so it can be written at all.
        const named = new RegExp(`['"]${field}['"]`, 'u').test(source);
        expect(`${owner}: ${named ? 'ok' : `${field} is never named`}`).toBe(
          `${owner}: ok`,
        );
      }

      // 3. Something re-runs the field the message lands on.
      const triggered =
        new RegExp(`trigger\\([^)]*['"]${reporter}['"]`, 'u').test(source) ||
        new RegExp(`deps:\\s*\\[[^\\]]*['"]${reporter}['"]`, 'u').test(source);
      expect(
        `${owner}: ${triggered ? 'ok' : `nothing re-runs ${reporter}`}`,
      ).toBe(`${owner}: ok`);
    }
  });
});
