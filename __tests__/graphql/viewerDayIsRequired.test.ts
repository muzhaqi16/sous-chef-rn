/**
 * Expiry counts are judged on the viewer's calendar day, never the server's.
 *
 * `Pantry.stats` counts expiring and expired items against `today`, and falls
 * back to the date in UTC when it is omitted. `stats` is cached unkeyed, so ONE
 * reader that omits it overwrites every screen's counts with UTC's, and the
 * badge disagrees with the rows for part of every day. Two rules hold it:
 *
 * - a `stats` selection reading `expiringCount`/`expiredCount` passes `today`;
 * - every `today` argument is bound to a NON-NULL variable, so the generated
 *   variables type makes each caller supply it. A nullable one type-checks
 *   with the variable left out, which is how two readers lost it.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import {
  buildSchema,
  getNamedType,
  isCompositeType,
  isInterfaceType,
  isObjectType,
  Kind,
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  type GraphQLCompositeType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const COUNT_FIELDS = new Set(['expiringCount', 'expiredCount']);

function graphqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...graphqlFiles(full));
    else if (full.endsWith('.graphql')) out.push(full);
  }
  return out;
}

type Fragments = Map<string, FragmentDefinitionNode>;

function selectedFieldNames(
  selectionSet: SelectionSetNode | undefined,
  fragments: Fragments,
): string[] {
  if (!selectionSet) return [];
  return selectionSet.selections.flatMap(selection => {
    if (selection.kind === Kind.FIELD) return [selection.name.value];
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      return selectedFieldNames(selection.selectionSet, fragments);
    }
    return selectedFieldNames(
      fragments.get(selection.name.value)?.selectionSet,
      fragments,
    );
  });
}

interface Audit {
  findings: string[];
  statsReaders: string[];
}

function auditOperation(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
  fragments: Fragments,
  result: Audit,
) {
  const name = operation.name?.value ?? '<anonymous>';
  const walk = (
    selectionSet: SelectionSetNode,
    parentType: GraphQLCompositeType,
    seen: Set<string>,
  ) => {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.INLINE_FRAGMENT) {
        const type = selection.typeCondition
          ? schema.getType(selection.typeCondition.name.value)
          : parentType;
        if (isCompositeType(type)) walk(selection.selectionSet, type, seen);
        continue;
      }
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragments.get(selection.name.value);
        if (!fragment || seen.has(fragment.name.value)) continue;
        const type = schema.getType(fragment.typeCondition.name.value);
        if (isCompositeType(type)) {
          walk(
            fragment.selectionSet,
            type,
            new Set([...seen, fragment.name.value]),
          );
        }
        continue;
      }

      const fieldName = selection.name.value;
      const today = selection.arguments?.find(
        argument => argument.name.value === 'today',
      );
      const where = `${name}: ${parentType.name}.${fieldName}`;

      if (
        parentType.name === 'Pantry' &&
        fieldName === 'stats' &&
        selectedFieldNames(selection.selectionSet, fragments).some(field =>
          COUNT_FIELDS.has(field),
        )
      ) {
        result.statsReaders.push(name);
        if (!today) result.findings.push(`${where} reads counts without today`);
      }

      if (today) {
        const bound =
          today.value.kind === Kind.VARIABLE ? today.value.name.value : null;
        const variable = operation.variableDefinitions?.find(
          definition => definition.variable.name.value === bound,
        );
        if (variable?.type.kind !== Kind.NON_NULL_TYPE) {
          result.findings.push(`${where} binds today to a nullable value`);
        }
      }

      if (!selection.selectionSet) continue;
      if (!isObjectType(parentType) && !isInterfaceType(parentType)) continue;
      const fieldType = parentType.getFields()[fieldName]?.type;
      const namedType = fieldType ? getNamedType(fieldType) : undefined;
      if (isCompositeType(namedType)) {
        walk(selection.selectionSet, namedType, seen);
      }
    }
  };

  const rootType =
    operation.operation === 'query'
      ? schema.getQueryType()
      : operation.operation === 'mutation'
      ? schema.getMutationType()
      : schema.getSubscriptionType();
  if (rootType) walk(operation.selectionSet, rootType, new Set());
}

function audit(schema: GraphQLSchema, documents: DocumentNode[]): Audit {
  const fragments: Fragments = new Map();
  for (const document of documents) {
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }
  }
  const result: Audit = { findings: [], statsReaders: [] };
  for (const document of documents) {
    for (const definition of document.definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        auditOperation(schema, definition, fragments, result);
      }
    }
  }
  return result;
}

const schema = buildSchema(
  readFileSync(join(SRC, 'graphql', 'generated', 'schema.graphql'), 'utf8'),
);

function projectDocuments(): DocumentNode[] {
  return graphqlFiles(SRC)
    .filter(
      file => !relative(SRC, file).startsWith(join('graphql', 'generated')),
    )
    .flatMap(file => {
      try {
        return [parse(readFileSync(file, 'utf8'))];
      } catch {
        // A malformed document is `npm run lint`'s finding, not this test's.
        return [];
      }
    });
}

describe('the viewer day reaches every expiry count', () => {
  it('holds for every operation in src', () => {
    const { findings, statsReaders } = audit(schema, projectDocuments());

    expect(findings).toEqual([]);
    // Not vacuous: the audit reached the known readers.
    expect(statsReaders).toEqual(
      expect.arrayContaining(['GetPantry', 'PantrySummaryForEvent']),
    );
  });

  it.each([
    [
      'omits today',
      'query Bad($id: ID!) { pantry(id: $id) { id stats { expiredCount } } }',
      'Bad: Pantry.stats reads counts without today',
    ],
    [
      'binds a nullable today',
      'query Bad($id: ID!, $today: LocalDate) { pantry(id: $id) { id stats(today: $today) { expiringCount } } }',
      'Bad: Pantry.stats binds today to a nullable value',
    ],
  ])('catches a reader that %s', (_, source, finding) => {
    expect(audit(schema, [parse(source)]).findings).toEqual([finding]);
  });
});
