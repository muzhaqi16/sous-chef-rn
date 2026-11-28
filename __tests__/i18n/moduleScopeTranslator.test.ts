import * as ts from 'typescript';
import {
  nodesOf,
  parseSource,
  productionSources,
} from '#/test-utils/sourceAst';

/**
 * `getI18n().t(...)` does not come back.
 *
 * CLAUDE.md: "Don't reintroduce `getI18n().t(...)` — `t` takes i18next's full
 * options (`t('key', { count })`, `t('key', 'English fallback')`)." The
 * module-scope `t` in `src/i18n/index.ts` IS `getI18n().t` with those overloads
 * in front of it, so the raw accessor buys nothing and loses the fallback form.
 *
 * The worklist is EMPTY, which makes this an invariant rather than a debt list:
 * every caller has been converted, so any finding is a regression to fix rather
 * than a number to watch.
 */

/**
 * Empty on purpose. Converting a caller is a `t(...)` swap plus an import
 * change — in a `.tsx` file the import must be aliased `tGlobal`, or the hook
 * used instead, because lint requires the language-aware `t` there.
 */
const LEGACY_CALLERS: string[] = [];

const isGetI18nCall = (node: ts.Node): boolean =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'getI18n';

/** Whether the file reads `.t` off `getI18n()`, directly or through a name. */
function readsRawTranslator(file: string, text?: string): boolean {
  const nodes = nodesOf(parseSource(file, text));
  const holders = new Set(
    nodes
      .filter(ts.isVariableDeclaration)
      .filter(
        declaration =>
          ts.isIdentifier(declaration.name) &&
          !!declaration.initializer &&
          isGetI18nCall(declaration.initializer),
      )
      .map(declaration => declaration.name.getText()),
  );
  return nodes.some(
    node =>
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 't' &&
      (isGetI18nCall(node.expression) ||
        (ts.isIdentifier(node.expression) &&
          holders.has(node.expression.text))),
  );
}

const FILES = productionSources();

const callers = FILES
  // `src/i18n` is where the accessor legitimately lives.
  .filter(file => !file.startsWith('src/i18n/'))
  .filter(file => readsRawTranslator(file))
  .sort();

describe('the deprecated translation accessor', () => {
  it('catches the accessor read through a name or optional chain', () => {
    expect(
      readsRawTranslator(
        'planted.ts',
        `const i18n = getI18n();\nexport const label = i18n.t('labels.save');`,
      ),
    ).toBe(true);
    expect(
      readsRawTranslator('planted.ts', `getI18n()?.t('labels.save');`),
    ).toBe(true);
  });

  it('has no callers', () => {
    const added = callers.filter(file => !LEGACY_CALLERS.includes(file));

    expect(added).toEqual([]);
  });

  it('the worklist only shrinks', () => {
    const converted = LEGACY_CALLERS.filter(file => !callers.includes(file));

    expect(converted).toEqual([]);
  });

  // A scan that finds nothing looks the same whether the tree is clean or the
  // walk broke, so assert it is still reading the tree it thinks it is.
  it('is still scanning the source tree', () => {
    expect(FILES.length).toBeGreaterThan(500);
  });
});
