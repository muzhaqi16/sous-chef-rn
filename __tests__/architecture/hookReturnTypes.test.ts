import * as path from 'node:path';
import * as ts from 'typescript';
import { SRC, walk } from '#/test-utils/queueableOperations';

/**
 * The import boundary keeps the client out of what renders; this is the other
 * half. A hook can hold the client correctly and still hand a screen an
 * `ApolloError`, a `NetworkStatus` or a whole result object, coupling it by its
 * TYPES while it imports nothing. The checker resolves each feature hook's real
 * return type — the type itself and each property one level down, where a leak
 * shows — and none may name the library.
 */
const ROOT = path.join(SRC, '..');

const BANNED_TYPES = [
  'ApolloError',
  'ApolloClient',
  'ApolloCache',
  'ApolloQueryResult',
  'InMemoryCache',
  'NetworkStatus',
  'ObservableQuery',
  'FetchResult',
  'MutationResult',
  'QueryResult',
  'SubscriptionResult',
];

const bannedIn = (typeText: string) =>
  BANNED_TYPES.filter(name => new RegExp(`\\b${name}\\b`).test(typeText));

const SKIP = [/\.test\.tsx?$/, /\.generated\.ts$/, /(^|\/)__mocks__(\/|$)/];

jest.setTimeout(300_000);

describe('a feature hook hands a screen no library type', () => {
  const hookFiles = walk(
    path.join(SRC, 'features'),
    name => name.endsWith('.ts') || name.endsWith('.tsx'),
  ).filter(
    file =>
      /\/features\/[^/]+\/hooks\//.test(file) && !SKIP.some(re => re.test(file)),
  );

  it('finds the feature hooks at all', () => {
    expect(hookFiles.length).toBeGreaterThan(50);
  });

  it('names no library type in any exported hook return', () => {
    const configPath = path.join(ROOT, 'tsconfig.json');
    const parsed = ts.parseJsonConfigFileContent(
      ts.readConfigFile(configPath, ts.sys.readFile).config,
      ts.sys,
      ROOT,
    );
    const program = ts.createProgram(hookFiles, {
      ...parsed.options,
      noEmit: true,
    });
    const checker = program.getTypeChecker();
    const FORMAT =
      ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.UseFullyQualifiedType;

    const renderType = (type: ts.Type, node: ts.Node) => {
      const parts = [checker.typeToString(type, node, FORMAT)];
      for (const prop of checker.getPropertiesOfType(type)) {
        const propType = checker.getTypeOfSymbolAtLocation(prop, node);
        parts.push(
          `${prop.getName()}: ${checker.typeToString(propType, node, FORMAT)}`,
        );
      }
      return parts.join('\n');
    };

    const leaks: string[] = [];
    let hooks = 0;
    for (const file of hookFiles) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const rel = path.relative(ROOT, file);
      ts.forEachChild(source, node => {
        const exported = ts.canHaveModifiers(node)
          ? ts
              .getModifiers(node)
              ?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
          : false;
        if (!exported) return;
        const declarations: Array<[string, ts.Node, ts.Identifier]> = [];
        if (ts.isFunctionDeclaration(node) && node.name) {
          declarations.push([node.name.text, node, node.name]);
        } else if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              declarations.push([decl.name.text, decl, decl.name]);
            }
          }
        }
        for (const [name, decl, ident] of declarations) {
          if (!/^use[A-Z]/.test(name)) continue;
          const symbol = checker.getSymbolAtLocation(ident);
          if (!symbol) continue;
          const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
          const [signature] = type.getCallSignatures();
          if (!signature) continue;
          hooks += 1;
          const rendered = renderType(
            checker.getReturnTypeOfSignature(signature),
            decl,
          );
          for (const banned of bannedIn(rendered)) {
            leaks.push(`${rel} ${name} hands back ${banned}`);
          }
        }
      });
    }

    expect(hooks).toBeGreaterThan(50);
    expect(leaks).toEqual([]);
  });
});
