import {
  Kind,
  getOperationAST,
  type DocumentNode,
  type TypeNode,
} from 'graphql';

/**
 * The operation name a generated document declares — the same value Apollo
 * reports as `operation.operationName`. Keying a table by this instead of a
 * literal makes a renamed operation fail at the `*Document` import.
 */
export function operationNameOf(document: DocumentNode): string {
  const name = getOperationAST(document)?.name?.value;
  if (!name) {
    throw new Error(
      'operationNameOf: the document declares no named operation',
    );
  }
  return name;
}

/**
 * The root field an operation selects — the name the cache stores its result
 * under on `ROOT_QUERY`, so an eviction names it through the document.
 */
export function rootFieldOf(document: DocumentNode): string {
  const [first] = getOperationAST(document)?.selectionSet.selections ?? [];
  if (first?.kind !== Kind.FIELD) {
    throw new Error('rootFieldOf: the operation selects no root field');
  }
  return first.name.value;
}

/** A table keyed by the operation each generated document declares. */
export function byOperation<T>(
  entries: ReadonlyArray<readonly [DocumentNode, T]>,
): Record<string, T> {
  return Object.fromEntries(
    entries.map(([document, value]) => [operationNameOf(document), value]),
  );
}

function namedType(type: TypeNode): string {
  return type.kind === Kind.NAMED_TYPE ? type.name.value : namedType(type.type);
}

/** The input type an operation's `$input` variable declares, if it has one. */
export function inputTypeNameOf(document: DocumentNode): string | null {
  const input = getOperationAST(document)?.variableDefinitions?.find(
    variable => variable.variable.name.value === 'input',
  );
  return input ? namedType(input.type) : null;
}
