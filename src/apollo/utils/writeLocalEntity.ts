import type {
  ApolloCache,
  OperationVariables,
  TypedDocumentNode,
} from '@apollo/client';
// The variant the project's HKT registration makes writeFragment take.
import type { GraphQLCodegenDataMasking } from '@apollo/client/masking';
import {
  Kind,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { isRecord } from '#/utils/isRecord';

type Row = Record<string, unknown>;
type Unmasked<TData> = GraphQLCodegenDataMasking.Unmasked<TData>;

/** The neutral fields of each record type a row reaches (generated). */
export type NeutralByType = Readonly<Record<string, Readonly<Row>>>;

interface LocalEntityWrite<TFragment> {
  fragment: TypedDocumentNode<TFragment, unknown>;
  fragmentName: string;
  /** The schema's resting value for every field (generated from the SDL). */
  neutral: Unmasked<TFragment>;
  /** The same, per type, for a nested record the create names. */
  neutralByType: NeutralByType;
  /** What the create knows, by field; a nested entity names its `id`. */
  known: Row & { __typename: string; id: string };
  variables?: OperationVariables;
}

/**
 * Writes an entity a local-first create made, complete for everything
 * `fragment` selects, so every query reading it resolves offline. Each field is
 * what the create knows, else what the cache already holds, else the neutral
 * value: held data is never overwritten, and a nested entity the create names,
 * alone or in a list, is completed the same way, field by field.
 */
export function writeLocalEntity<TFragment>(
  cache: ApolloCache,
  write: LocalEntityWrite<TFragment>,
): void {
  const document: DocumentNode = write.fragment;
  const root = fragmentNamed(document, write.fragmentName);
  // A nested record completes from its field's neutral, else its type's.
  const shapeOf = (record: Row, base: unknown): Row => {
    if (isRecord(base) && !Array.isArray(base)) return base;
    const type = record.__typename;
    return typeof type === 'string' ? write.neutralByType[type] ?? {} : {};
  };
  const complete = (
    selectionSet: SelectionSetNode,
    known: Row,
    neutral: Row,
  ): Row => {
    const ref = entityRef(known);
    const cacheId = ref ? cache.identify(ref) : undefined;
    const out: Row = { __typename: known.__typename ?? neutral.__typename };
    for (const field of fieldsOf(document, selectionSet)) {
      const key = field.alias?.value ?? field.name.value;
      if (key === '__typename') continue;
      const value = known[key];
      const base = neutral[key];
      if (value !== undefined) {
        const { selectionSet: sub } = field;
        out[key] = !sub
          ? value
          : Array.isArray(value)
          ? value.map((element: unknown) =>
              isRecord(element)
                ? complete(sub, element, shapeOf(element, undefined))
                : element,
            )
          : isRecord(value)
          ? complete(sub, value, shapeOf(value, base))
          : value;
        continue;
      }
      const held =
        ref && cacheId
          ? readField(cache, document, ref.__typename, cacheId, field, write)
          : undefined;
      out[key] = held === undefined ? base : held;
    }
    return out;
  };

  const neutral = isRecord(write.neutral) ? write.neutral : {};
  const data = complete(root.selectionSet, write.known, neutral);
  const id = cache.identify({
    __typename: write.known.__typename,
    id: write.known.id,
  });
  cache.writeFragment({
    id,
    fragment: write.fragment,
    fragmentName: write.fragmentName,
    // Assembled field by field from the fragment's own selection.
    data: data as Unmasked<TFragment>,
    variables: write.variables,
  });
  // Retained, as every explicit write is, until a removal releases it: a queued
  // create must survive a `gc()` even where no list links it yet.
}

/** The entity a value names; a neutral stand-in (`id: ''`) names none. */
const entityRef = (value: Row): { __typename: string; id: string } | null =>
  typeof value.__typename === 'string' &&
  typeof value.id === 'string' &&
  value.id !== ''
    ? { __typename: value.__typename, id: value.id }
    : null;

function fragmentNamed(
  document: DocumentNode,
  name: string,
): FragmentDefinitionNode {
  const found = document.definitions.find(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      definition.name.value === name,
  );
  if (!found) throw new Error(`writeLocalEntity: no fragment ${name}`);
  return found;
}

/** The fields a selection makes, spreads and inline fragments flattened. */
function fieldsOf(
  document: DocumentNode,
  selectionSet: SelectionSetNode,
): FieldNode[] {
  return selectionSet.selections.flatMap(selection => {
    if (selection.kind === Kind.FIELD) return [selection];
    const inner =
      selection.kind === Kind.FRAGMENT_SPREAD
        ? fragmentNamed(document, selection.name.value).selectionSet
        : selection.selectionSet;
    return fieldsOf(document, inner);
  });
}

// A field is taken from the cache only when the cache holds ALL of it: a
// partial read would be written back just as partial.
const singleFieldDocs = new WeakMap<FieldNode, Map<string, DocumentNode>>();

function readField(
  cache: ApolloCache,
  document: DocumentNode,
  typename: string,
  cacheId: string,
  field: FieldNode,
  { variables }: { variables?: OperationVariables },
): unknown {
  const byType = singleFieldDocs.get(field) ?? new Map<string, DocumentNode>();
  singleFieldDocs.set(field, byType);
  const key = field.alias?.value ?? field.name.value;
  // One name per content, so no two documents share a name.
  const fragmentName = `_writeLocalEntity_${typename}_${key}`;
  let doc = byType.get(typename);
  if (!doc) {
    doc = {
      kind: Kind.DOCUMENT,
      definitions: [
        ...document.definitions,
        {
          kind: Kind.FRAGMENT_DEFINITION,
          name: { kind: Kind.NAME, value: fragmentName },
          typeCondition: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: typename },
          },
          selectionSet: { kind: Kind.SELECTION_SET, selections: [field] },
        },
      ],
    };
    byType.set(typename, doc);
  }
  const read = cache.readFragment<Row>({
    id: cacheId,
    fragment: doc,
    fragmentName,
    variables,
  });
  return read && key in read ? read[key] : undefined;
}

const idOnlyDocs = new Map<string, DocumentNode>();

/** Whether the cache holds the entity at all (a create can then name it). */
export function isHeld(
  cache: ApolloCache,
  ref: { __typename: string; id: string },
): boolean {
  const cacheId = cache.identify(ref);
  if (!cacheId) return false;
  let doc = idOnlyDocs.get(ref.__typename);
  if (!doc) {
    doc = {
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.FRAGMENT_DEFINITION,
          name: { kind: Kind.NAME, value: `_isHeld_${ref.__typename}` },
          typeCondition: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: ref.__typename },
          },
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [
              { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'id' } },
            ],
          },
        },
      ],
    };
    idOnlyDocs.set(ref.__typename, doc);
  }
  return cache.readFragment({ id: cacheId, fragment: doc }) !== null;
}
