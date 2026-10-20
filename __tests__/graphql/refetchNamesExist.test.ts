import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { Kind, OperationTypeNode, parse } from 'graphql';
import {
  OPERATION_ROOT_DIRS,
  PRODUCTION_ROOT_DIRS,
} from '#/test-utils/sourceRoots';

/**
 * A core hook refetches a screen's query by name, because the core cannot
 * import a document a mobile screen owns. Apollo matches nothing for a name no
 * query has, with no error outside development, so each name is held to a
 * query here: renaming or removing one fails this test instead of quietly
 * leaving a screen unrefreshed.
 */
const ROOT = path.join(__dirname, '..', '..');

const filesUnder = (dir: string, keep: (name: string) => boolean): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['generated', '__tests__', '__mocks__'].includes(entry.name)
        ? []
        : filesUnder(full, keep);
    }
    return keep(entry.name) ? [full] : [];
  });

const queryNames = new Set(
  OPERATION_ROOT_DIRS.flatMap(dir =>
    filesUnder(dir, name => name.endsWith('.graphql')),
  ).flatMap(file =>
    parse(fs.readFileSync(file, 'utf8')).definitions.flatMap(definition =>
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.operation === OperationTypeNode.QUERY &&
      definition.name
        ? [definition.name.value]
        : [],
    ),
  ),
);

type NamedRefetch = { file: string; name: string };
type Scan = { names: NamedRefetch[]; unreadable: string[] };

/** A property's key, written as an identifier or a string. */
const keyOf = (property: ts.ObjectLiteralElementLike): string | undefined =>
  property.name &&
  (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    ? property.name.text
    : undefined;

/**
 * Every query name a refetch is given: an `include` passed to
 * `refetchQueries(...)`, and a `refetchQueries` option in any object. A name
 * held where this cannot read it (a variable, a call) is reported instead, so
 * the check below can never pass on a name it did not see.
 */
function scanRefetches(file: string, text: string): Scan {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const scan: Scan = { names: [], unreadable: [] };
  const where = (node: ts.Node): string =>
    `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const readElement = (element: ts.Expression): void => {
    if (
      ts.isStringLiteral(element) ||
      ts.isNoSubstitutionTemplateLiteral(element)
    ) {
      scan.names.push({ file, name: element.text });
    } else if (
      // A document, or `{ query, variables }`: the compiler checks those.
      !(ts.isIdentifier(element) && element.text.endsWith('Document')) &&
      !ts.isObjectLiteralExpression(element)
    ) {
      scan.unreadable.push(where(element));
    }
  };
  const readValue = (value: ts.Expression): void => {
    if (ts.isParenthesizedExpression(value)) {
      readValue(value.expression);
    } else if (ts.isConditionalExpression(value)) {
      readValue(value.whenTrue);
      readValue(value.whenFalse);
    } else if (ts.isArrayLiteralExpression(value)) {
      value.elements.forEach(readElement);
    } else if (ts.isArrowFunction(value) && !ts.isBlock(value.body)) {
      readValue(value.body);
    } else if (
      !(
        (ts.isStringLiteral(value) ||
          ts.isNoSubstitutionTemplateLiteral(value)) &&
        ['active', 'all'].includes(value.text)
      )
    ) {
      scan.unreadable.push(where(value));
    }
  };
  const readProperty = (property: ts.ObjectLiteralElementLike): void => {
    if (ts.isPropertyAssignment(property)) {
      readValue(property.initializer);
    } else {
      scan.unreadable.push(where(property));
    }
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'refetchQueries'
    ) {
      const [options] = node.arguments;
      if (options && ts.isObjectLiteralExpression(options)) {
        options.properties
          .filter(property => keyOf(property) === 'include')
          .forEach(readProperty);
      } else {
        scan.unreadable.push(where(node));
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      node.properties
        .filter(property => keyOf(property) === 'refetchQueries')
        .forEach(readProperty);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return scan;
}

const scans = PRODUCTION_ROOT_DIRS.flatMap(dir =>
  filesUnder(dir, name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
).map(file =>
  scanRefetches(path.relative(ROOT, file), fs.readFileSync(file, 'utf8')),
);
const refetches = scans.flatMap(scan => scan.names);

describe('queries refetched by name', () => {
  it('finds the named refetches, so the check below is not vacuous', () => {
    expect(refetches).toContainEqual(
      expect.objectContaining({ name: 'GetMealPlan' }),
    );
    expect(queryNames.size).toBeGreaterThan(50);
  });

  it('names only queries that exist', () => {
    expect(
      refetches
        .filter(refetch => !queryNames.has(refetch.name))
        .map(refetch => `${refetch.name} (${refetch.file})`),
    ).toEqual([]);
  });

  it('can read every name a refetch is given', () => {
    expect(scans.flatMap(scan => scan.unreadable)).toEqual([]);
  });
});

describe('the scan', () => {
  const namesIn = (text: string): string[] =>
    scanRefetches('fixture.ts', text).names.map(found => found.name);
  const unreadableIn = (text: string): string[] =>
    scanRefetches('fixture.ts', text).unreadable;

  it.each([
    ["client.refetchQueries({ include: ['Missing'] })"],
    ["client.refetchQueries({ 'include': ['Missing'] })"],
    ['client.refetchQueries({ include: [`Missing`] })'],
    ["client.refetchQueries({ include: on ? ['Missing'] : [] })"],
    ["useMutation(Doc, { refetchQueries: ['Missing'] })"],
    ["client.mutate({ mutation: Doc, refetchQueries: ['Missing'] })"],
    ["useMutation(Doc, { refetchQueries: () => ['Missing'] })"],
  ])('reads the name in %s', text => {
    expect(namesIn(text)).toEqual(['Missing']);
  });

  it.each([
    ['client.refetchQueries({ include })'],
    ['client.refetchQueries({ include: names })'],
    ['client.refetchQueries(options)'],
    ['useMutation(Doc, { refetchQueries })'],
    ['client.refetchQueries({ include: [name] })'],
  ])('reports %s, which it cannot read', text => {
    expect(unreadableIn(text)).toHaveLength(1);
  });

  it('accepts what the compiler checks, and the keywords', () => {
    const text =
      "client.refetchQueries({ include: 'active' });" +
      'client.refetchQueries({ include: [GetHomesDocument, { query: Doc }] });';
    expect(scanRefetches('fixture.ts', text)).toEqual({
      names: [],
      unreadable: [],
    });
  });
});
