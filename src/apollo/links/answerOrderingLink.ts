import { ApolloLink, Observable, type ApolloCache } from '@apollo/client';
import {
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';
import { VERSIONED_TYPES } from '#/graphql/generated/versionedTypes.generated';
import { isIncremental } from '#/apollo/utils/isIncremental';
import { isRecord } from '#/utils/isRecord';

type Fragments = ReadonlyMap<string, FragmentDefinitionNode>;

const possibleTypes: Readonly<Record<string, readonly string[]>> =
  fragmentMatcherData.possibleTypes;

/** Whether a fragment's type condition covers an object of `typename`. */
const fits = (typename: string, condition: string): boolean =>
  condition === typename ||
  (possibleTypes[condition]?.includes(typename) ?? false);

const fragmentsByDocument = new WeakMap<DocumentNode, Fragments>();

const fragmentsOf = (document: DocumentNode): Fragments => {
  const known = fragmentsByDocument.get(document);
  if (known) return known;
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }
  fragmentsByDocument.set(document, fragments);
  return fragments;
};

/** The fields a selection set gives an object of `typename`, through its fragments. */
const fieldsFor = (
  selectionSet: SelectionSetNode,
  typename: string,
  fragments: Fragments,
  out: FieldNode[] = [],
): FieldNode[] => {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      out.push(selection);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const condition = selection.typeCondition?.name.value;
      if (!condition || fits(typename, condition)) {
        fieldsFor(selection.selectionSet, typename, fragments, out);
      }
    } else {
      const fragment = fragments.get(selection.name.value);
      if (fragment && fits(typename, fragment.typeCondition.name.value)) {
        fieldsFor(fragment.selectionSet, typename, fragments, out);
      }
    }
  }
  return out;
};

const FRAGMENT_NAME = 'AnswerOrdering';

const fragmentOn = (
  typename: string,
  selections: readonly FieldNode[],
  fragments: Fragments = new Map(),
): DocumentNode => ({
  kind: Kind.DOCUMENT,
  definitions: [
    {
      kind: Kind.FRAGMENT_DEFINITION,
      name: { kind: Kind.NAME, value: FRAGMENT_NAME },
      typeCondition: {
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: typename },
      },
      selectionSet: { kind: Kind.SELECTION_SET, selections },
    },
    ...fragments.values(),
  ],
});

const VERSION_FIELD: FieldNode = {
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: 'version' },
};
const versionFragments = new Map<string, DocumentNode>();

/** The version the server last gave the device for a row, below any optimistic layer. */
const heldVersion = (
  cache: ApolloCache,
  cacheId: string,
  typename: string,
): number | undefined => {
  let fragment = versionFragments.get(typename);
  if (!fragment) {
    fragment = fragmentOn(typename, [VERSION_FIELD]);
    versionFragments.set(typename, fragment);
  }
  const held = cache.readFragment<{ version?: unknown }>({
    id: cacheId,
    fragment,
    optimistic: false,
  });
  return typeof held?.version === 'number' ? held.version : undefined;
};

const keyOf = (field: FieldNode): string => (field.alias ?? field.name).value;

const isRow = (value: unknown): boolean =>
  isRecord(value) && value.id !== undefined;

/** No number orders a list's membership, so its rows land as answered. */
const landsAsAnswered = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.some(isRow)
    : isRecord(value) &&
      typeof value.__typename === 'string' &&
      value.__typename.endsWith('Connection');

/**
 * The device's value of an older row's field over the answer's. A row the field
 * still points at was judged on its own, and an embedded object is laid over key
 * by key, so a key the device lacks keeps the answer's value. A value replacing
 * the answer's whole must be complete, or Apollo stores a partial row.
 */
const newest = (
  answered: unknown,
  held: unknown,
  complete: boolean,
): unknown => {
  if (
    held === undefined ||
    landsAsAnswered(answered) ||
    landsAsAnswered(held)
  ) {
    return answered;
  }
  if (!isRecord(held)) return held;
  if (isRecord(answered) && !Array.isArray(answered) && !Array.isArray(held)) {
    if (!isRow(answered) && !isRow(held)) {
      for (const [key, value] of Object.entries(held)) {
        answered[key] = newest(answered[key], value, complete);
      }
      return answered;
    }
    if (answered.id === held.id) return answered;
  }
  return complete ? held : answered;
};

/**
 * Lays the device's copy over each row in `value` that the server numbered
 * older than the one the device holds. Nested rows are judged on their own.
 */
const order = (
  cache: ApolloCache,
  value: unknown,
  selectionSet: SelectionSetNode,
  fragments: Fragments,
  variables: Record<string, unknown>,
  // An answer's root object carries no `__typename`; its operation type names it.
  rootTypename?: string,
): void => {
  if (Array.isArray(value)) {
    for (const element of value) {
      order(cache, element, selectionSet, fragments, variables);
    }
    return;
  }
  if (!isRecord(value)) return;
  const typename =
    typeof value.__typename === 'string' ? value.__typename : rootTypename;
  if (!typename) return;
  const fields = fieldsFor(selectionSet, typename, fragments);
  for (const field of fields) {
    if (!field.selectionSet) continue;
    const child = value[keyOf(field)];
    order(cache, child, field.selectionSet, fragments, variables);
  }
  if (
    !VERSIONED_TYPES.has(typename) ||
    typeof value.id !== 'string' ||
    typeof value.version !== 'number'
  ) {
    return;
  }
  const cacheId = cache.identify({ __typename: typename, id: value.id });
  if (!cacheId) return;
  const held = heldVersion(cache, cacheId, typename);
  if (held === undefined || value.version >= held) return;
  const selectionsByKey = new Map<string, FieldNode[]>();
  for (const field of fields) {
    const key = keyOf(field);
    selectionsByKey.set(key, [...(selectionsByKey.get(key) ?? []), field]);
  }
  for (const [key, selections] of selectionsByKey) {
    if (landsAsAnswered(value[key])) continue;
    const read = (returnPartialData: boolean) =>
      cache.readFragment<Record<string, unknown>>({
        id: cacheId,
        fragment: fragmentOn(typename, selections, fragments),
        fragmentName: FRAGMENT_NAME,
        variables,
        optimistic: false,
        returnPartialData,
      });
    const device = read(true);
    if (device) {
      value[key] = newest(value[key], device[key], read(false) !== null);
    }
  }
};

/**
 * A server answer's copy of a row never replaces a copy the server numbered
 * newer: nothing in the cache sees both copies of a normalized row, so this
 * lays the device's copy over the answer before Apollo stores it. Verified:
 * `#apollo-a-type-merge-never-sees-a-normalized-rows-fields`.
 */
export function createAnswerOrderingLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const definition = operation.query.definitions.find(
      node => node.kind === Kind.OPERATION_DEFINITION,
    );
    if (
      definition?.kind !== Kind.OPERATION_DEFINITION ||
      definition.operation === OperationTypeNode.SUBSCRIPTION ||
      isIncremental(operation.query)
    ) {
      return forward(operation);
    }
    const fragments = fragmentsOf(operation.query);
    return new Observable<ApolloLink.Result>(observer =>
      forward(operation).subscribe({
        next: result => {
          if (isRecord(result.data)) {
            order(
              operation.client.cache,
              result.data,
              definition.selectionSet,
              fragments,
              operation.variables,
              definition.operation === OperationTypeNode.MUTATION
                ? 'Mutation'
                : 'Query',
            );
          }
          observer.next(result);
        },
        error: (error: unknown) => observer.error(error),
        complete: () => observer.complete(),
      }),
    );
  });
}
