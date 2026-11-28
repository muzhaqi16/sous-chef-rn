import * as ts from 'typescript';
import {
  calleeName,
  jsxAttribute,
  jsxAttributeText,
  jsxElementsOf,
  nodesOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';
import { ValidationError, type AnySchema } from 'yup';
import { shoppingItemSchema } from '#features/shoppingList/hooks/shoppingItemFormConfig';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
} from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import { editItemSchema } from '#features/pantry/components/form/pantryItemFormConfig';
import { createItemSchema } from '#features/catalog/utils/itemValidation';
import {
  recipeFormSchema,
  recipeFormDefaults,
} from '#features/recipes/screens/RecipeForm/recipeFormConfig';

/**
 * Every validation message has a place on screen.
 *
 * `net-weight-needs-value` shipped able to fail with no consumer rendering
 * `errors.netWeight` anywhere: picking a weight unit without typing a weight
 * made Save refuse, `reportValidationErrors` wrote a `logger.warn`, and the button
 * was dead with nothing on screen to explain it. In edit mode a stored row with
 * a unit and no weight could never be saved at all.
 *
 * CLAUDE.md: "A field the user can fix is reported ON the field, never through
 * `alertService.alert`." A field reported NOWHERE is strictly worse than either.
 * So this walks the real schemas, collects every field path that can carry a
 * message, and asserts the owning feature renders each one.
 */

/** Every .tsx under a feature: its rendering surface. */
const featureFiles = (dir: string): ts.SourceFile[] =>
  productionSources(`src/features/${dir}/**/*.tsx`).map(file =>
    parseSource(file),
  );

const endsWith = (expression: ts.Expression, name: string) =>
  new RegExp(`(^|\\.)${name}\\??$`).test(expression.getText());

/** Whether a file reads `errors.<field>`, `errors?.<field>` or `errors['<field>']`. */
const readsErrorOf = (source: ts.SourceFile, field: string): boolean =>
  nodesOf(source).some(
    node =>
      (ts.isPropertyAccessExpression(node) &&
        node.name.text === field &&
        endsWith(node.expression, 'errors')) ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === field &&
        endsWith(node.expression, 'errors')),
  );

/** Field paths that carry a message for at least one of `inputs`. */
async function failingPaths(
  schema: AnySchema,
  inputs: readonly object[],
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
 * `fieldState.error`: read in that Controller's own render, as a property or
 * destructured, so a `fieldState` elsewhere cannot vouch for it.
 */
const renderedThroughController = (
  source: ts.SourceFile,
  field: string,
): boolean =>
  jsxElementsOf(source)
    .filter(element => element.tagName.getText() === 'Controller')
    .some(element => {
      const name = jsxAttribute(element, 'name');
      const render = jsxAttribute(element, 'render')?.initializer;
      if (!name || jsxAttributeText(name) !== field || !render) return false;
      return nodesOf(render).some(
        node =>
          (ts.isPropertyAccessExpression(node) &&
            node.name.text === 'error' &&
            endsWith(node.expression, 'fieldState')) ||
          (ts.isBindingElement(node) &&
            (node.propertyName ?? node.name).getText() === 'fieldState' &&
            ts.isObjectBindingPattern(node.name) &&
            node.name.elements.some(
              inner => (inner.propertyName ?? inner.name).getText() === 'error',
            )),
      );
    });

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
      { ...pantryBase, itemName: 'Milk', sizeInput: '500' },
      { ...pantryBase, itemName: 'Milk', sizeInput: '0' },
      {
        ...pantryBase,
        itemName: 'Milk',
        quantityInput: '1.5',
        sizeInput: '5',
        sizeUnitId: 'unit-1',
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
  {
    name: 'recipeFormSchema',
    schema: recipeFormSchema as unknown as AnySchema,
    feature: 'recipes',
    inputs: [
      recipeFormDefaults(),
      {
        ...recipeFormDefaults(),
        imageUrl: 'example.com',
        tips: 'x'.repeat(2001),
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`).join(','),
      },
    ],
  },
] as const;

describe('validation messages have a rendering consumer', () => {
  const sources = new Map<string, ts.SourceFile[]>();
  beforeAll(() => {
    for (const feature of new Set(CASES.map(c => c.feature))) {
      sources.set(feature, featureFiles(feature));
    }
  });

  it('reads a Controller however its name and error are written', () => {
    const planted = parseSource(
      'planted.tsx',
      `<Controller
        control={control}
        name={'unitId'}
        render={({ fieldState: { error } }) => <UnitField error={error?.message} />}
      />`,
    );

    expect(renderedThroughController(planted, 'unitId')).toBe(true);
    expect(renderedThroughController(planted, 'quantity')).toBe(false);
  });

  it.each(CASES.map(c => [c.name, c] as const))(
    '%s',
    async (_name, testCase) => {
      const paths = await failingPaths(testCase.schema, [...testCase.inputs]);
      expect(paths.length).toBeGreaterThan(0);

      const files = sources.get(testCase.feature) ?? [];
      for (const field of paths) {
        // Two ways a form reports a field, and the guard has to see both. It used
        // to know only the first, so a field rendered the idiomatic
        // `Controller`/`fieldState` way read as having no consumer at all.
        //
        // `errors.netWeight` must not be satisfied by `errors.netWeightUnit`.
        // `netWeights[0].value` is reported by whatever renders `netWeights`:
        // the row index stops addressing an editor row once empty rows drop out.
        const root = field.split(/[.[]/)[0] ?? field;
        const viaErrorsObject = files.some(file => readsErrorOf(file, root));
        const viaFieldState = files.some(file =>
          renderedThroughController(file, root),
        );
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
 * `useState`, so "Please select a unit" could never clear.
 */

interface CrossFieldRule {
  /** The field the message lands on. */
  reporter: string;
  /** The sibling fields the rule reads. */
  reads: string[];
}

/** The schema object a declaration builds, through any call chain on it. */
const schemaObjectOf = (
  init: ts.Expression,
): ts.ObjectLiteralExpression | undefined => {
  for (const node of nodesOf(init)) {
    if (!ts.isCallExpression(node)) continue;
    const name = calleeName(node) ?? '';
    const [first] = node.arguments;
    if (
      (name === 'object' ||
        name.endsWith('.object') ||
        name.endsWith('.shape')) &&
      first &&
      ts.isObjectLiteralExpression(first)
    ) {
      return first;
    }
  }
  return undefined;
};

/** The siblings a field's rule reads: `context.parent.x`, `.when('x')`, `ref('x')`. */
const siblingsRead = (rule: ts.Node): string[] =>
  nodesOf(rule).flatMap(node => {
    if (
      ts.isPropertyAccessExpression(node) &&
      endsWith(node.expression, 'parent') &&
      /(^|\.)(context|this)\.parent$/.test(node.expression.getText())
    ) {
      return [node.name.text];
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node) ?? '';
      const [first] = node.arguments;
      if (
        (name.endsWith('.when') || name === 'ref') &&
        first &&
        ts.isStringLiteral(first)
      ) {
        return [first.text];
      }
    }
    return [];
  });

/** Cross-field rules per exported schema in one module. */
function crossFieldRules(
  file: string,
  text?: string,
): Map<string, CrossFieldRule[]> {
  const bySchema = new Map<string, CrossFieldRule[]>();
  for (const statement of parseSource(file, text).statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const schema =
        declaration.initializer && schemaObjectOf(declaration.initializer);
      if (!schema) continue;
      const rules = schema.properties.flatMap(property => {
        const reporter = ts.isPropertyAssignment(property)
          ? propertyName(property.name)
          : undefined;
        if (!reporter || !ts.isPropertyAssignment(property)) return [];
        // A `$name` is yup context the form passes, not a field it holds.
        const reads = [...new Set(siblingsRead(property.initializer))].filter(
          field => field !== reporter && !field.startsWith('$'),
        );
        return reads.length > 0 ? [{ reporter, reads }] : [];
      });
      if (rules.length > 0) bySchema.set(declaration.name.getText(), rules);
    }
  }
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
    'src/features/shoppingList/components/moveToPantry/useMoveToPantryForm.ts',
  resetPasswordSchema: 'src/features/auth/screens/ResetPasswordScreen.tsx',
  changePasswordSchema: 'src/features/profile/screens/ChangePasswordScreen.tsx',
  templateItemSchema:
    'src/features/mealPlan/screens/MealTemplateBuilderScreen.tsx',
  // Resolved by SearchResults; its fields are written and re-run here.
  scanAmountSchema: 'src/features/barcode/components/ScanAmountSection.tsx',
  receiptLineSchema: 'src/features/receipts/components/ReceiptLineSheet.tsx',
  restockSchema:
    'src/features/pantry/components/modals/RestockPantryItemModal.tsx',
  generateShoppingListSchema:
    'src/features/mealPlan/components/GenerateShoppingListSheet.tsx',
  correctWeightSchema:
    'src/features/pantry/components/modals/CorrectPackageSizeModal.tsx',
  reportContentSchema: 'src/features/profile/ui/ReportContentSheet.tsx',
};

describe('cross-field rules are re-run by their form', () => {
  const schemas = new Map<string, CrossFieldRule[]>();
  beforeAll(() => {
    for (const file of productionSources()) {
      for (const [name, rules] of crossFieldRules(file)) {
        schemas.set(name, rules);
      }
    }
  });

  it('reads a rule however its schema is built', () => {
    const planted = `export const unitSchema = yup
      .object({
        quantity: string().when('unitId', ([unitId], rule) => rule),
        unitId: string(),
      })
      .test('one', 'msg', () => true);`;

    expect([...crossFieldRules('planted.ts', planted)]).toEqual([
      ['unitSchema', [{ reporter: 'quantity', reads: ['unitId'] }]],
    ]);
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
    const form = nodesOf(parseSource(owner));
    const strings = new Set(
      form.filter(ts.isStringLiteral).map(literal => literal.text),
    );

    for (const { reporter, reads } of rules ?? []) {
      for (const field of reads) {
        // 1. Nothing shadows a schema field. The pantry bug: the unit id the
        //    rule reads lived in `useState`, so it never reached the resolver.
        const shadowed = form.some(
          node =>
            ts.isVariableDeclaration(node) &&
            ts.isArrayBindingPattern(node.name) &&
            !!node.initializer &&
            ts.isCallExpression(node.initializer) &&
            /(^|\.)useState$/.test(calleeName(node.initializer) ?? '') &&
            node.name.elements[0]?.getText() === field,
        );
        expect(
          `${owner}: ${shadowed ? `${field} is held in useState` : 'ok'}`,
        ).toBe(`${owner}: ok`);

        // 2. The form names the field, so it can be written at all.
        const named = strings.has(field);
        expect(`${owner}: ${named ? 'ok' : `${field} is never named`}`).toBe(
          `${owner}: ok`,
        );
      }

      // 3. Something re-runs the field the message lands on.
      const names = (node: ts.Node) =>
        nodesOf(node).some(
          inner => ts.isStringLiteral(inner) && inner.text === reporter,
        );
      const triggered = form.some(
        node =>
          (ts.isCallExpression(node) &&
            /(^|\.)trigger$/.test(calleeName(node) ?? '') &&
            node.arguments.some(names)) ||
          (ts.isPropertyAssignment(node) &&
            propertyName(node.name) === 'deps' &&
            names(node.initializer)),
      );
      expect(
        `${owner}: ${triggered ? 'ok' : `nothing re-runs ${reporter}`}`,
      ).toBe(`${owner}: ok`);
    }
  });
});
