import {
  Kind,
  valueFromASTUntyped,
  type DirectiveNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type InlineFragmentNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValueNode,
} from 'graphql';
import { isRecord } from '#/utils/isRecord';

// Which fragments a query's result holds on which entities, read from its
// document and its data, masked or not: masking keeps a selection's own `id`
// and `__typename`. Each is a `<fragment>@<typename>:<id>` key.
interface Walk {
  fragments: ReadonlyMap<string, FragmentDefinitionNode>;
  variables: unknown;
}

const operationOf = (
  document: DocumentNode,
): OperationDefinitionNode | undefined =>
  document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );

const walkOf = (document: DocumentNode, variables: unknown): Walk => ({
  fragments: new Map(
    document.definitions
      .filter(
        (definition): definition is FragmentDefinitionNode =>
          definition.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map(fragment => [fragment.name.value, fragment]),
  ),
  variables,
});

const valueOf = (node: ValueNode, { variables }: Walk): unknown =>
  valueFromASTUntyped(node, isRecord(variables) ? variables : {});

const isIncluded = (
  directives: readonly DirectiveNode[] | undefined,
  walk: Walk,
): boolean =>
  (directives ?? []).every(directive => {
    const name = directive.name.value;
    if (name !== 'include' && name !== 'skip') return true;
    const [condition] = directive.arguments ?? [];
    const holds = !!condition && valueOf(condition.value, walk) === true;
    return name === 'include' ? holds : !holds;
  });

const entityOf = (value: unknown): string | null =>
  isRecord(value) &&
  typeof value.__typename === 'string' &&
  typeof value.id === 'string'
    ? `${value.__typename}:${value.id}`
    : null;

const fieldValue = (field: FieldNode, value: Record<string, unknown>) =>
  value[(field.alias ?? field.name).value];

// A condition naming an interface or union is left unread: matching it needs
// the schema's possible types.
const appliesTo = (fragment: InlineFragmentNode, value: unknown): boolean =>
  !fragment.typeCondition ||
  (isRecord(value) && fragment.typeCondition.name.value === value.__typename);

function collectCarried(
  selectionSet: SelectionSetNode,
  value: unknown,
  walk: Walk,
  carried: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const element of value) {
      collectCarried(selectionSet, element, walk, carried);
    }
    return;
  }
  if (!isRecord(value)) return;
  const entity = entityOf(value);
  for (const selection of selectionSet.selections) {
    if (!isIncluded(selection.directives, walk)) continue;
    switch (selection.kind) {
      case Kind.FIELD:
        if (selection.selectionSet) {
          collectCarried(
            selection.selectionSet,
            fieldValue(selection, value),
            walk,
            carried,
          );
        }
        break;
      case Kind.INLINE_FRAGMENT:
        if (appliesTo(selection, value)) {
          collectCarried(selection.selectionSet, value, walk, carried);
        }
        break;
      case Kind.FRAGMENT_SPREAD: {
        const name = selection.name.value;
        if (entity) carried.add(`${name}@${entity}`);
        const fragment = walk.fragments.get(name);
        if (fragment) {
          collectCarried(fragment.selectionSet, value, walk, carried);
        }
        break;
      }
    }
  }
}

/** Every fragment the result holds on an entity, nested ones included. */
export function fragmentsCarried(
  document: DocumentNode,
  variables: unknown,
  data: unknown,
): ReadonlySet<string> {
  const carried = new Set<string>();
  const operation = operationOf(document);
  if (operation) {
    collectCarried(
      operation.selectionSet,
      data,
      walkOf(document, variables),
      carried,
    );
  }
  return carried;
}

// An entity read only for its key fields and fragments.
function collectNeeded(
  selectionSet: SelectionSetNode,
  value: unknown,
  walk: Walk,
  needed: Set<string>,
): boolean {
  const entity = entityOf(value);
  if (!entity) return false;
  return selectionSet.selections.every(selection => {
    if (!isIncluded(selection.directives, walk)) return true;
    switch (selection.kind) {
      case Kind.FIELD:
        return (
          !selection.selectionSet &&
          (selection.name.value === 'id' ||
            selection.name.value === '__typename')
        );
      case Kind.INLINE_FRAGMENT:
        return (
          appliesTo(selection, value) &&
          collectNeeded(selection.selectionSet, value, walk, needed)
        );
      case Kind.FRAGMENT_SPREAD:
        needed.add(`${selection.name.value}@${entity}`);
        return true;
    }
  });
}

// A root field that looks its entity up by id reads what the cache holds for
// that id; any other (the current home, today's plan) may name another now.
const namesById = (field: FieldNode, value: unknown, walk: Walk): boolean =>
  isRecord(value) &&
  (field.arguments ?? []).some(
    argument => valueOf(argument.value, walk) === value.id,
  );

/**
 * The fragments a query's data is made of, when it is only fragments on
 * entities its root fields look up by id; else null.
 */
export function fragmentsNeeded(
  document: DocumentNode,
  variables: unknown,
  data: unknown,
): ReadonlySet<string> | null {
  const operation = operationOf(document);
  if (!operation || !isRecord(data)) return null;
  const walk = walkOf(document, variables);
  const needed = new Set<string>();
  const onlyFragments = operation.selectionSet.selections.every(selection => {
    if (!isIncluded(selection.directives, walk)) return true;
    if (selection.kind !== Kind.FIELD) return false;
    if (selection.name.value === '__typename') return true;
    const value = fieldValue(selection, data);
    return (
      !!selection.selectionSet &&
      namesById(selection, value, walk) &&
      collectNeeded(selection.selectionSet, value, walk, needed)
    );
  });
  return onlyFragments && needed.size > 0 ? needed : null;
}
