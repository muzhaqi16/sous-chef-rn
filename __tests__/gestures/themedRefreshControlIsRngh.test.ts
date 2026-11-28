import * as ts from 'typescript';
import { nodesOf, parseSource } from '#/test-utils/sourceAst';

/**
 * `ThemedRefreshControl` is the single place the RNGH-vs-RN choice is made for
 * every list, so `sous-chef/rngh-refresh-control-matches-host` exempts this one
 * module — and this is what holds it instead.
 *
 * RNGH's ScrollView hands its scroll gesture on as
 * `cloneElement(refreshControl, { block })`, which only a control built by
 * `createNativeWrapper` routes into `useNativeGesture`. Built on React Native's
 * control the prop is inert: no error, no warning, and a spinner that hangs
 * mid-list.
 */
const FILE = 'src/components/atoms/themedComponents.tsx';

/** The module the component `name` is built from, through any wrapper or alias. */
function moduleBehind(
  name: string,
  file: string = FILE,
  text?: string,
): string | undefined {
  const source = parseSource(file, text);
  const declaration = nodesOf(source).find(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && node.name.getText() === name,
  );
  const init = declaration?.initializer;
  const base = init && ts.isCallExpression(init) ? init.arguments[0] : init;
  if (!base || !ts.isIdentifier(base)) return undefined;
  for (const statement of source.statements) {
    const bindings = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : undefined;
    if (
      ts.isImportDeclaration(statement) &&
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(element => element.name.text === base.text) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return statement.moduleSpecifier.text;
    }
  }
  return undefined;
}

describe('ThemedRefreshControl', () => {
  it("catches a control built on React Native's under RNGH's import", () => {
    const planted = `
      import { RefreshControl } from 'react-native';
      import { RefreshControl as GestureRefresh } from 'react-native-gesture-handler';
      export const ThemedRefreshControl = withUnistyles(RefreshControl, theme);`;

    expect(moduleBehind('ThemedRefreshControl', 'planted.tsx', planted)).toBe(
      'react-native',
    );
  });

  it('is built on RNGH, not React Native', () => {
    expect(moduleBehind('ThemedRefreshControl')).toBe(
      'react-native-gesture-handler',
    );
  });

  it('keeps a counterpart for plain RN scrollable hosts', () => {
    // Without it, a plain host has nothing to use: the RNGH control throws there.
    expect(moduleBehind('PlainScrollRefreshControl')).toBe('react-native');
  });
});
