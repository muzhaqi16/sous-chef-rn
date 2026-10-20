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

/** String elements of every array under a `refetchQueries({ include })`. */
function namedRefetches(file: string): NamedRefetch[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: NamedRefetch[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && ts.isArrayLiteralExpression(node.parent)) {
      found.push({ file: path.relative(ROOT, file), name: node.text });
    }
    ts.forEachChild(node, collect);
  };
  const visit = (node: ts.Node): void => {
    const [options] = ts.isCallExpression(node) ? node.arguments : [];
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'refetchQueries' &&
      options &&
      ts.isObjectLiteralExpression(options)
    ) {
      for (const property of options.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'include'
        ) {
          collect(property.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const refetches = PRODUCTION_ROOT_DIRS.flatMap(dir =>
  filesUnder(dir, name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
).flatMap(namedRefetches);

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
});
