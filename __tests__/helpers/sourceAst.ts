import { readFileSync } from 'fs';
import { sync as glob } from 'glob';
import * as ts from 'typescript';

/** A file's syntax tree, parsed as TSX so JSX and type syntax both read. */
export function parseSource(
  file: string,
  text: string = readFileSync(file, 'utf8'),
): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

/** Every node under `root`, itself included, depth first. */
export function nodesOf(root: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return out;
}

/** The 1-based line `node` starts on. */
export const lineOf = (node: ts.Node): number => {
  const source = node.getSourceFile();
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
};

/** Production sources: no tests, mocks or generated files. */
export const productionSources = (pattern = 'src/**/*.{ts,tsx}'): string[] =>
  glob(pattern, {
    ignore: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/*.generated.ts',
      '**/*.d.ts',
    ],
  }).sort();

/** A property's name as written, for an identifier or string key. */
export const propertyName = (name: ts.PropertyName): string | undefined =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

/** The first `name: …` property anywhere in `root`, or undefined. */
export function findProperty(
  root: ts.Node,
  name: string,
): ts.PropertyAssignment | undefined {
  return nodesOf(root).find(
    (node): node is ts.PropertyAssignment =>
      ts.isPropertyAssignment(node) && propertyName(node.name) === name,
  );
}

/** A JSX element's attribute by name, or undefined. */
export function jsxAttribute(
  element: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return element.attributes.properties.find(
    (attr): attr is ts.JsxAttribute =>
      ts.isJsxAttribute(attr) && attr.name.getText() === name,
  );
}

/** A JSX attribute's value as written: the string, or the expression's text. */
export function jsxAttributeText(attr: ts.JsxAttribute): string | undefined {
  const init = attr.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    return ts.isStringLiteral(init.expression)
      ? init.expression.text
      : init.expression.getText();
  }
  return undefined;
}

/** Every opening or self-closing JSX element under `root`. */
export const jsxElementsOf = (root: ts.Node): ts.JsxOpeningLikeElement[] =>
  nodesOf(root).filter(
    (node): node is ts.JsxOpeningLikeElement =>
      ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
  );

/** `a.b(...)` as `a.b`, or a bare `f(...)` as `f`; otherwise undefined. */
export function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.getText();
  return undefined;
}

/** Every module a file loads: imports, re-exports, `import()` and `require()`. */
export const moduleSpecifiersOf = (file: string, text?: string): string[] =>
  nodesOf(parseSource(file, text)).flatMap(node => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      return [node.moduleSpecifier.text];
    }
    if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const loads =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require');
      return loads && first && ts.isStringLiteral(first) ? [first.text] : [];
    }
    return [];
  });
