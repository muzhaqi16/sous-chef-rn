import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { relative, resolve } from 'path';
import {
  Kind,
  parse,
  visit,
  type DefinitionNode,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import * as ts from 'typescript';
import { SRC, walk } from '#/test-utils/queueableOperations';

/**
 * Two operations selecting one merged connection share a cache field.
 * `mergeAuthoritativeFirstPage` reads a missing `hasNextPage` as "covers the
 * whole list", so a consumer selecting no `pageInfo` strips it — and the other
 * consumer's read goes permanently incomplete.
 *
 * Only a WRITE strips it, so only documents that can write are checked: every
 * operation, and every fragment that is spread anywhere or whose generated
 * document appears anywhere but as the `fragment` of a read call's options
 * (`readFragment`, `useFragment`, …). A fragment the scan cannot place counts
 * as a write. There are no exemptions: a selection writing edges selects
 * `pageInfo` too.
 */
const OPERATION_FILES = globSync('src/**/*.graphql')
  .map(f => relative(process.cwd(), f))
  .filter(f => !f.endsWith('generated/schema.graphql'));

/**
 * Connection fields carrying a merge policy. Globbed rather than read from one
 * file: the policies live with their features, so a hard-coded path would stop
 * seeing the policy a change actually lands in.
 */
const POLICY_FILES = globSync('src/features/*/cache/typePolicies.ts');

const mergedConnectionFields = (): string[] => {
  const declarations = POLICY_FILES.map(f => readFileSync(f, 'utf8')).join(
    '\n',
  );
  return [
    ...new Set(
      [
        ...declarations.matchAll(
          /^\s*(\w+):\s*(?:\.\.\.)?mergeConnectionByNodeId\(/gm,
        ),
      ]
        .map(m => m[1]!)
        .filter(name => name !== 'homes'),
    ),
  ];
};

const MERGED_FIELDS = new Set(mergedConnectionFields());

type Definition = (OperationDefinitionNode | FragmentDefinitionNode) & {
  file: string;
};

const isExecutable = (
  def: DefinitionNode,
): def is OperationDefinitionNode | FragmentDefinitionNode =>
  def.kind === Kind.OPERATION_DEFINITION ||
  def.kind === Kind.FRAGMENT_DEFINITION;

const DEFINITIONS: Definition[] = OPERATION_FILES.flatMap(file =>
  parse(readFileSync(file, 'utf8'))
    .definitions.filter(isExecutable)
    .map(def => ({ ...def, file })),
);

const nameOf = (def: Definition) => def.name?.value ?? '';

const FRAGMENTS = new Map(
  DEFINITIONS.filter(
    (def): def is FragmentDefinitionNode & { file: string } =>
      def.kind === Kind.FRAGMENT_DEFINITION,
  ).map(def => [def.name.value, def] as const),
);

/** Fragment names some other definition spreads. */
const SPREAD = new Set(
  DEFINITIONS.flatMap(def => {
    const spread: string[] = [];
    visit(def, {
      FragmentSpread(node) {
        if (node.name.value !== nameOf(def)) spread.push(node.name.value);
      },
    });
    return spread;
  }),
);

/** Fragment name → the generated `…FragmentDoc` export that carries it. */
const FRAGMENT_DOCS = new Map(
  globSync('src/**/*.generated.ts').flatMap(file => {
    const exported = require(resolve(file)) as Record<string, unknown>;
    return Object.entries(exported).flatMap(([name, value]) => {
      if (!name.endsWith('FragmentDoc')) return [];
      const [first] = (value as DocumentNode).definitions;
      return first?.kind === Kind.FRAGMENT_DEFINITION
        ? [[first.name.value, name] as const]
        : [];
    });
  }),
);

const READS = new Set([
  'readFragment',
  'useFragment',
  'useFragmentList',
  'useSuspenseFragment',
  'watchFragment',
]);

const calleeName = (call: ts.CallExpression): string | undefined => {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
};

/** `{ fragment: Doc }` passed straight to a read — the one use that is not a write. */
const isReadArgument = (doc: ts.Identifier): boolean => {
  const property = doc.parent;
  if (!ts.isPropertyAssignment(property) || property.initializer !== doc) {
    return false;
  }
  if (!ts.isIdentifier(property.name) || property.name.text !== 'fragment') {
    return false;
  }
  const options = property.parent;
  const call = options.parent;
  return (
    ts.isCallExpression(call) &&
    call.arguments.includes(options) &&
    READS.has(calleeName(call) ?? '')
  );
};

/** An import, a re-export or a `typeof` names a document without using it. */
const isMention = (doc: ts.Identifier): boolean =>
  ts.isImportSpecifier(doc.parent) ||
  ts.isExportSpecifier(doc.parent) ||
  ts.isTypeQueryNode(doc.parent);

/** Generated fragment documents some production code uses other than to read. */
const DOCS_REACHING_A_WRITE = new Set(
  walk(SRC, name => /\.tsx?$/.test(name) && !name.endsWith('.generated.ts'))
    .filter(file => !/[\\/]__mocks__[\\/]/.test(file))
    .flatMap(file => {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const written: string[] = [];
      const scan = (node: ts.Node) => {
        if (
          ts.isIdentifier(node) &&
          node.text.endsWith('FragmentDoc') &&
          !isMention(node) &&
          !isReadArgument(node)
        ) {
          written.push(node.text);
        }
        ts.forEachChild(node, scan);
      };
      scan(source);
      return written;
    }),
);

const canWrite = (def: Definition): boolean => {
  if (def.kind !== Kind.FRAGMENT_DEFINITION) return true;
  if (SPREAD.has(def.name.value)) return true;
  const doc = FRAGMENT_DOCS.get(def.name.value);
  return !doc || DOCS_REACHING_A_WRITE.has(doc);
};

/** A selection set's field names, through inline fragments and spreads. */
const fieldNames = (
  selectionSet: SelectionSetNode | undefined,
  seen = new Set<string>(),
): Set<string> => {
  const names = new Set<string>();
  for (const selection of selectionSet?.selections ?? []) {
    if (selection.kind === Kind.FIELD) {
      names.add(selection.name.value);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      fieldNames(selection.selectionSet, seen).forEach(n => names.add(n));
    } else if (!seen.has(selection.name.value)) {
      seen.add(selection.name.value);
      const fragment = FRAGMENTS.get(selection.name.value);
      fieldNames(fragment?.selectionSet, seen).forEach(n => names.add(n));
    }
  }
  return names;
};

const offenders = DEFINITIONS.filter(canWrite).flatMap(def => {
  const found: string[] = [];
  visit(def, {
    Field(node) {
      if (!MERGED_FIELDS.has(node.name.value)) return;
      const names = fieldNames(node.selectionSet);
      // Only a selection carrying `edges` writes a PAGE. A count-only read
      // writes no edges, and the merge preserves the cached list against it.
      if (names.has('edges') && !names.has('pageInfo')) {
        found.push(`${def.file}#${node.name.value}`);
      }
    },
  });
  return found;
});

describe('operations sharing a merged connection field', () => {
  it('finds the merge policies and the documents to check', () => {
    // Either scan returning nothing would pass this file vacuously.
    expect(POLICY_FILES.length).toBeGreaterThan(3);
    expect(MERGED_FIELDS.size).toBeGreaterThan(5);
    expect(OPERATION_FILES.length).toBeGreaterThan(10);
  });

  it('reads a connection selection through its spreads', () => {
    const batches = DEFINITIONS.flatMap(def => {
      const found: Set<string>[] = [];
      visit(def, {
        Field(node) {
          if (node.name.value === 'pantryItemBatchesConnection') {
            found.push(fieldNames(node.selectionSet));
          }
        },
      });
      return found;
    });

    expect(batches.length).toBeGreaterThan(0);
    expect(batches.some(names => names.has('edges'))).toBe(true);
  });

  it('finds every definition and the document each fragment generates', () => {
    const fragments = [...FRAGMENTS.keys()];

    expect(
      DEFINITIONS.some(
        def =>
          def.kind === Kind.OPERATION_DEFINITION && def.operation === 'query',
      ),
    ).toBe(true);
    expect(fragments.length).toBeGreaterThan(50);
    expect(fragments.filter(name => !FRAGMENT_DOCS.has(name))).toEqual([]);
  });

  it('treats only a fragment every use of which is a read as read-only', () => {
    const byName = (name: string) =>
      DEFINITIONS.find(def => nameOf(def) === name)!;

    // Read through `readFragment` alone.
    expect(canWrite(byName('homePantries_home'))).toBe(false);
    expect(canWrite(byName('useDefaultHome_home'))).toBe(false);
    // Written directly, never spread: only the use scan can catch these.
    expect(canWrite(byName('favorites_savedDetails'))).toBe(true);
    expect(canWrite(byName('favorites_row'))).toBe(true);
    // Read in one place, and written in another through a variable.
    expect(canWrite(byName('purchase_write'))).toBe(true);
    // Spread into an operation; an operation itself.
    expect(canWrite(byName('LoginUser'))).toBe(true);
    expect(canWrite(byName('GetHomes'))).toBe(true);
  });

  it('selects pageInfo everywhere, so no consumer strips it', () => {
    expect(offenders).toEqual([]);
  });
});
