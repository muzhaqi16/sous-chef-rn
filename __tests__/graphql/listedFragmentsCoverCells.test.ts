import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import {
  buildSchema,
  getNamedType,
  Kind,
  OperationTypeNode,
  parse,
  print,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import {
  OPERATION_ROOT_DIRS,
  PRODUCTION_ROOT_DIRS,
} from '#/test-utils/sourceRoots';

/**
 * A component that reads its fragment from the cache by id renders only when
 * the cache holds every field it selects, so a field nothing fetches blanks it
 * rather than failing anywhere else. Every such read is found in the source,
 * and each is held to a query that selects it whole. A list a core hook runs
 * spreads a core `listed` fragment, whose header names the cells it feeds; it
 * covers each of them.
 */
const ROOT = path.join(__dirname, '..', '..');
const schema = buildSchema(
  fs.readFileSync(
    path.join(ROOT, 'src/graphql/generated/schema.graphql'),
    'utf8',
  ),
);

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

const fragments = new Map<string, FragmentDefinitionNode>();
const queries: OperationDefinitionNode[] = [];
/** Each listed fragment, with the cells its header names. */
const listed = new Map<string, string[]>();

const graphqlFiles = OPERATION_ROOT_DIRS.flatMap(dir =>
  filesUnder(dir, name => name.endsWith('.graphql')),
);
for (const file of graphqlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const definition of parse(text).definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    } else if (
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.operation === OperationTypeNode.QUERY
    ) {
      queries.push(definition);
    }
  }
}
for (const file of graphqlFiles) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const name = /^fragment (\w+_listed) on /.exec(line)?.[1];
    if (!name) return;
    const header: string[] = [];
    for (let i = index - 1; i >= 0 && lines[i]?.startsWith('#'); i--) {
      header.unshift(lines[i] ?? '');
    }
    const named = [...header.join(' ').matchAll(/`(\w+)`/g)].map(m => m[1]);
    listed.set(
      name,
      named.filter((n): n is string => n !== undefined && fragments.has(n)),
    );
  });
}

/** Every field path a selection reaches, its arguments included, spreads followed. */
function fieldPaths(
  selectionSet: SelectionSetNode,
  prefix = '',
  out = new Set<string>(),
): Set<string> {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === '__typename') continue;
      const args = selection.arguments?.length
        ? `(${selection.arguments
            .map(arg => `${arg.name.value}: ${print(arg.value)}`)
            .join(', ')})`
        : '';
      const fieldPath = `${prefix}.${selection.name.value}${args}`;
      out.add(fieldPath);
      if (selection.selectionSet) {
        fieldPaths(selection.selectionSet, fieldPath, out);
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = fragments.get(selection.name.value);
      if (!fragment) throw new Error(`No fragment ${selection.name.value}`);
      fieldPaths(fragment.selectionSet, prefix, out);
    } else {
      fieldPaths(selection.selectionSet, prefix, out);
    }
  }
  return out;
}

const pathsOf = (name: string): Set<string> => {
  const fragment = fragments.get(name);
  if (!fragment) throw new Error(`No fragment ${name}`);
  return fieldPaths(fragment.selectionSet);
};

const missingFrom = (needed: Set<string>, held: Set<string>): string[] =>
  [...needed].filter(p => !held.has(p));

/** What each query selects on each type, one entry per selection set. */
const querySelections = new Map<string, Set<string>[]>();
for (const query of queries) {
  const typeInfo = new TypeInfo(schema);
  visit(
    query,
    visitWithTypeInfo(typeInfo, {
      SelectionSet(node) {
        const type = getNamedType(typeInfo.getParentType());
        if (!type) return;
        const sets = querySelections.get(type.name) ?? [];
        sets.push(fieldPaths(node));
        querySelections.set(type.name, sets);
      },
    }),
  );
}

type ByIdRead = { file: string; fragment: string; typename: string };

/** A string-literal property of an object literal, by name. */
const stringProperty = (
  object: ts.ObjectLiteralExpression,
  name: string,
): string | undefined => {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name &&
      ts.isStringLiteral(property.initializer)
    ) {
      return property.initializer.text;
    }
  }
  return undefined;
};

/** `useFragment({ fragmentName, from: { __typename, id } })`, the `from` possibly behind a condition. */
function byIdReads(file: string): ByIdRead[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const reads: ByIdRead[] = [];
  const visitNode = (node: ts.Node): void => {
    const [options] = ts.isCallExpression(node) ? node.arguments : [];
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useFragment' &&
      options &&
      ts.isObjectLiteralExpression(options)
    ) {
      const fragment = stringProperty(options, 'fragmentName');
      let typename: string | undefined;
      const findTypename = (child: ts.Node): void => {
        if (ts.isObjectLiteralExpression(child)) {
          typename ??= stringProperty(child, '__typename');
        }
        ts.forEachChild(child, findTypename);
      };
      for (const property of options.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'from'
        ) {
          findTypename(property.initializer);
        }
      }
      if (fragment && typename) {
        reads.push({
          file: path.relative(ROOT, file),
          fragment,
          typename,
        });
      }
    }
    ts.forEachChild(node, visitNode);
  };
  visitNode(source);
  return reads;
}

const reads = PRODUCTION_ROOT_DIRS.flatMap(dir =>
  filesUnder(dir, name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
).flatMap(byIdReads);

describe('cells read by id', () => {
  it('finds the reads, so the check below is not vacuous', () => {
    expect(reads.length).toBeGreaterThan(20);
    expect(reads).toContainEqual(
      expect.objectContaining({
        fragment: 'PantryItemCard_pantryItem',
        typename: 'PantryItem',
      }),
    );
  });

  it('reads only fragments some query selects whole', () => {
    const unfetched = reads
      .filter(read => {
        const needed = pathsOf(read.fragment);
        const selections = querySelections.get(read.typename) ?? [];
        return !selections.some(
          held => missingFrom(needed, held).length === 0,
        );
      })
      .map(read => `${read.fragment} (${read.file})`);
    expect(unfetched).toEqual([]);
  });

  it('reports a field no query selects', () => {
    const needed = new Set([
      ...pathsOf('PantryItemCard_pantryItem'),
      '.fetchedNowhere',
    ]);
    const selections = querySelections.get('PantryItem') ?? [];
    expect(selections.length).toBeGreaterThan(0);
    expect(
      selections.some(held => missingFrom(needed, held).length === 0),
    ).toBe(false);
  });
});

describe('listed fragments cover the cells that read through them', () => {
  it('names at least one cell in every listed header', () => {
    expect(
      [...listed].filter(([, cells]) => cells.length === 0).map(([n]) => n),
    ).toEqual([]);
    expect(listed.size).toBeGreaterThanOrEqual(3);
  });

  it.each(
    [...listed].flatMap(([name, cells]) =>
      cells.map((cell): [string, string] => [name, cell]),
    ),
  )('%s covers %s', (name, cell) => {
    expect(missingFrom(pathsOf(cell), pathsOf(name))).toEqual([]);
  });

  it('reports a field a cell selects and its list does not', () => {
    const fewer = new Set(
      [...pathsOf('home_listed')].filter(p => p !== '.name'),
    );
    expect(missingFrom(pathsOf('HomeCard_home'), fewer)).toEqual(['.name']);
  });
});
