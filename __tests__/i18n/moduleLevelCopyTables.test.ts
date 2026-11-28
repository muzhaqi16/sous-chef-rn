import * as ts from 'typescript';
import {
  lineOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * The one shape no lint rule in this repo can see.
 *
 * `i18next/no-literal-string` checks JSX text and copy-carrying attributes;
 * `no-restricted-syntax` checks toasts and alerts. Both look at
 * the point where a string is *written*. A module-level table —
 *
 *   const STEPS = [{ instruction: 'Swipe right to see item actions' }];
 *   …
 *   <Text>{step.instruction}</Text>
 *
 * — writes the string somewhere neither rule inspects and renders it as an
 * identifier, which is indistinguishable from any other variable. Four separate
 * sweeps missed exactly this shape, and it was found each time by grep, which
 * means it was only ever caught when someone thought to look.
 *
 * The same shape is a second bug independent of translation: a `const`
 * evaluated at import time freezes whichever language loaded first, so even a
 * localized table built this way stops following a language change. The fix for
 * both is the same — hold **key paths** and resolve with `t` at render, or make
 * the table a factory taking `t`. `moduleLevelResolvedKeys` below is the guard
 * for that half; the two are independent and a table can hit either alone.
 *
 * It reads each module-level `const` from the syntax tree, so a table's depth,
 * line wrapping and comments do not hide a value. Which strings read as prose
 * is still a pattern: it fails a PR that reintroduces the shape, and does not
 * prove the category empty.
 */

/**
 * Files whose matches are a decision, not an oversight. Each entry needs a
 * reason, so adding one should be deliberate.
 */
const ALLOWED: string[] = [];

/**
 * Property names that carry copy.
 *
 * An include list, mirroring the `jsx-attributes.include` list in `eslint/i18n.js`
 * and for the same measured reason: scoping by property name is smaller and
 * more stable than excluding the open-ended set of properties that hold
 * enum-ish identifiers. Without it this scan also reports `operation: 'Add
 * Item'` (an `errorService.reportError` tag), `reason:` strings from biometric
 * eligibility logging, and Android channel ids — none of which are copy.
 */
const COPY_PROPS = [
  'title',
  'label',
  'placeholder',
  'message',
  'description',
  'subtitle',
  'subtext',
  'text',
  'body',
  'summary',
  'instruction',
  'emptyText',
  'emptyMessage',
  'emptyTitle',
  'emptyStateMessage',
  'emptyStateSubtext',
  'header',
  'heading',
  'caption',
  'hint',
  'helperText',
  'errorText',
  'confirmText',
  'cancelText',
  'confirmLabel',
  'cancelLabel',
  'buttonText',
  'buttonLabel',
  'actionLabel',
  'accessibilityLabel',
  'accessibilityHint',
  'modalTitle',
  'searchPlaceholder',
];

/** A value that reads like English prose: a capitalised word, then more. */
const PROSE = /^[A-Z][a-z]+(?:[ /][A-Za-z0-9&'’,.!?-]+)+$/;

/**
 * Only a module-scope `t` can be called at module level; a component's
 * `useTranslation()` binding doesn't exist there. Requiring this import is what
 * separates the real bug from the `title: t(…)` lines inside component bodies.
 */
const MODULE_T = new Set(['#i18n/t']);

/**
 * Copy-carrying properties under each module-level `const`. `intoFunctions`
 * false stops at a function: what a function body holds runs at call time.
 */
function copyProperties(
  source: ts.SourceFile,
  intoFunctions: boolean,
): ts.PropertyAssignment[] {
  const found: ts.PropertyAssignment[] = [];
  const visit = (node: ts.Node) => {
    if (!intoFunctions && ts.isFunctionLike(node)) return;
    if (
      ts.isPropertyAssignment(node) &&
      COPY_PROPS.includes(propertyName(node.name) ?? '')
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.flags & ts.NodeFlags.Const
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer) visit(declaration.initializer);
      }
    }
  }
  return found;
}

const report = (file: string, property: ts.PropertyAssignment) =>
  `${file}:${lineOf(property.initializer)}  ${propertyName(property.name)}`;

/** Copy written as an English string in a module-level table. */
function proseIn(file: string, text?: string): string[] {
  return copyProperties(parseSource(file, text), true)
    .filter(property => {
      const value = property.initializer;
      return (
        (ts.isStringLiteral(value) ||
          ts.isNoSubstitutionTemplateLiteral(value)) &&
        PROSE.test(value.text)
      );
    })
    .map(property => report(file, property));
}

/** Copy resolved through the module-scope `t` when the module loads. */
function resolvedKeysIn(file: string, text?: string): string[] {
  const source = parseSource(file, text);
  const importsModuleT = source.statements.some(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      MODULE_T.has(statement.moduleSpecifier.text),
  );
  if (!importsModuleT) return [];
  return copyProperties(source, false)
    .filter(property => {
      const value = property.initializer;
      return (
        ts.isCallExpression(value) &&
        ts.isIdentifier(value.expression) &&
        value.expression.text === 't'
      );
    })
    .map(property => report(file, property));
}

const FILES = productionSources().filter(
  file =>
    !file.includes('/locales/') &&
    !ALLOWED.some(allowed => file.endsWith(allowed)),
);

describe('module-level tables of user-visible copy', () => {
  it('catches copy past a comment, and a key resolved as the module loads', () => {
    const planted = `import { t } from '#i18n/t';
export const STEPS = [
  {
    instruction:
      // the first step a person sees
      'Swipe right to see item actions',
  },
];
export const TABS = [{ label: t('labels.all') }];
export const makeTabs = () => [{ label: t('labels.all') }];`;

    expect(proseIn('planted.ts', planted)).toEqual([
      'planted.ts:6  instruction',
    ]);
    expect(resolvedKeysIn('planted.ts', planted)).toEqual([
      'planted.ts:9  label',
    ]);
  });

  it('are not reintroduced — hold key paths or take t, never resolved strings', () => {
    expect(FILES.flatMap(file => proseIn(file))).toEqual([]);
  });

  it('do not resolve keys at import time, which freezes the bootstrap language', () => {
    expect(FILES.flatMap(file => resolvedKeysIn(file))).toEqual([]);
  });
});
