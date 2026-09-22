import { readFileSync } from 'fs';
import path from 'path';
import { sync as glob } from 'glob';
import ts from 'typescript';

/**
 * Every key a Unistyles stylesheet declares is read somewhere. The RN lint rule
 * `react-native/no-unused-styles` only sees `StyleSheet.create({...})` object
 * literals, so it misses Unistyles' `StyleSheet.create(theme => ...)` factory —
 * which is how some 75 files came to declare a `pressed` style no element read.
 *
 * A key is read by `sheet.key`, `sheet.key(...)`, destructuring, or a spread of
 * the whole sheet. An exported sheet counts reads in the files that import it.
 */

const sources = glob('src/**/*.{ts,tsx}', {
  ignore: ['**/__tests__/**', '**/*.generated.ts', '**/__mocks__/**'],
});

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

/** The object literal a `StyleSheet.create` call defines, if it has one. */
const sheetObject = (
  call: ts.CallExpression,
): ts.ObjectLiteralExpression | undefined => {
  const [arg] = call.arguments;
  if (!arg) return undefined;
  if (ts.isObjectLiteralExpression(arg)) return arg;
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    let body: ts.Node = arg.body;
    while (ts.isParenthesizedExpression(body)) body = body.expression;
    if (ts.isObjectLiteralExpression(body)) return body;
    if (ts.isBlock(body)) {
      const returned = body.statements.find(ts.isReturnStatement)?.expression;
      if (returned && ts.isObjectLiteralExpression(returned)) return returned;
    }
  }
  return undefined;
};

interface Sheet {
  file: string;
  binding: string;
  exported: boolean;
  keys: string[];
}

const sheetsIn = (source: ts.SourceFile): Sheet[] => {
  const sheets: Sheet[] = [];
  source.statements.forEach(statement => {
    if (!ts.isVariableStatement(statement)) return;
    const exported = !!statement.modifiers?.some(
      m => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    statement.declarationList.declarations.forEach(declaration => {
      const init = declaration.initializer;
      if (
        !init ||
        !ts.isCallExpression(init) ||
        init.expression.getText() !== 'StyleSheet.create' ||
        !ts.isIdentifier(declaration.name)
      ) {
        return;
      }
      const object = sheetObject(init);
      if (!object) return;
      const keys = object.properties
        .filter(property => !ts.isSpreadAssignment(property))
        .map(property => property.name?.getText().replace(/['"]/g, ''))
        .filter((key): key is string => !!key);
      sheets.push({
        file: source.fileName,
        binding: declaration.name.text,
        exported,
        keys,
      });
    });
  });
  return sheets;
};

/** Keys of `binding` read in `source`; `'*'` when the whole sheet escapes. */
const readsIn = (source: ts.SourceFile, binding: string): Set<string> => {
  const reads = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === binding
    ) {
      reads.add(node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === binding
    ) {
      reads.add('*');
    } else if (
      ts.isSpreadElement(node) ||
      ts.isSpreadAssignment(node) ||
      ts.isJsxSpreadAttribute(node)
    ) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === binding
      ) {
        reads.add('*');
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === binding
    ) {
      if (ts.isObjectBindingPattern(node.name)) {
        node.name.elements.forEach(element =>
          reads.add((element.propertyName ?? element.name).getText()),
        );
      } else {
        reads.add('*');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return reads;
};

const ALIASES: Array<[string, string]> = Object.entries(
  (
    JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
      compilerOptions: { paths: Record<string, string[]> };
    }
  ).compilerOptions.paths,
).map(([alias, [target]]) => [
  alias.replace('/*', ''),
  target!.replace('/*', ''),
]);

/** The file a module specifier names, without its extension. */
const resolveSpecifier = (from: string, specifier: string): string => {
  if (specifier.startsWith('.')) {
    return path.normalize(path.join(path.dirname(from), specifier));
  }
  const match = ALIASES.filter(
    ([alias]) => specifier === alias || specifier.startsWith(`${alias}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) return specifier;
  return path.normalize(specifier.replace(match[0], match[1]));
};

const withoutExtension = (file: string) => file.replace(/\.(ts|tsx)$/, '');

describe('stylesheet keys are read', () => {
  it('declares no key that nothing reads', () => {
    const parsed = new Map(sources.map(file => [file, parse(file)]));
    const unread: string[] = [];

    parsed.forEach(source => {
      sheetsIn(source).forEach(sheet => {
        const reads = readsIn(source, sheet.binding);
        if (sheet.exported) {
          parsed.forEach(importer => {
            importer.statements.forEach(statement => {
              if (
                !ts.isImportDeclaration(statement) ||
                !ts.isStringLiteral(statement.moduleSpecifier)
              ) {
                return;
              }
              const target = resolveSpecifier(
                importer.fileName,
                statement.moduleSpecifier.text,
              );
              if (target !== withoutExtension(sheet.file)) return;
              const named = statement.importClause?.namedBindings;
              if (!named || !ts.isNamedImports(named)) return;
              named.elements
                .filter(
                  element =>
                    (element.propertyName ?? element.name).text ===
                    sheet.binding,
                )
                .forEach(element =>
                  readsIn(importer, element.name.text).forEach(key =>
                    reads.add(key),
                  ),
                );
            });
          });
        }
        if (reads.has('*')) return;
        sheet.keys
          .filter(key => !reads.has(key))
          .forEach(key =>
            unread.push(`${sheet.file}: ${sheet.binding}.${key}`),
          );
      });
    });

    // Delete the key, or read it. A style a component still wants belongs on
    // the element that renders it.
    expect(unread.sort()).toEqual([]);
  });
});
