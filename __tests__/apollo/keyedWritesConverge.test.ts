import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  isInputObjectType,
  Kind,
  type GraphQLNamedType,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { LOCAL_WRITES } from '#/apollo/pendingWrites/localWriteRegistry';
import { SRC, authoredMutations } from '#/test-utils/queueableOperations';

/**
 * A `keyed` write's resend under a spent key writes nothing and answers the row
 * as it stands. Sending a key the input lacks fails the write outright, and
 * without `converged` the queue reads that answer as this write's own and moves
 * the writes behind it past a co-member's change.
 */

const schema = buildSchema(
  fs.readFileSync(
    path.join(SRC, 'graphql', 'generated', 'schema.graphql'),
    'utf8',
  ),
  { assumeValidSDL: true },
);

const keyedNames = Object.entries(LOCAL_WRITES)
  .filter(([, write]) => write.keyed)
  .map(([name]) => name)
  .sort();

const operationNamed = (name: string): OperationDefinitionNode => {
  const operation = authoredMutations().get(name);
  if (!operation) throw new Error(`${name} is not an authored mutation`);
  return operation;
};

const rootFieldOf = (operation: OperationDefinitionNode) => {
  const [selection] = operation.selectionSet.selections;
  if (selection?.kind !== Kind.FIELD) {
    throw new Error('a mutation opens on its field');
  }
  return selection;
};

const inputTypeOf = (operation: OperationDefinitionNode): GraphQLNamedType => {
  const field = schema.getMutationType()?.getFields()[
    rootFieldOf(operation).name.value
  ];
  let type = field?.args.find(arg => arg.name === 'input')?.type;
  while (type && 'ofType' in type) type = type.ofType;
  if (!type) throw new Error(`${operation.name?.value} takes no input`);
  return type;
};

const selectsConverged = (selectionSet: SelectionSetNode): boolean =>
  selectionSet.selections.some(selection => {
    if (selection.kind === Kind.FIELD) {
      return selection.name.value === 'converged';
    }
    return (
      selection.kind === Kind.INLINE_FRAGMENT &&
      selectsConverged(selection.selectionSet)
    );
  });

describe('a keyed write', () => {
  it('covers every update the server dedupes on a key', () => {
    expect(keyedNames).toEqual([
      'UpdateBrandList',
      'UpdatePantryItem',
      'UpdateShoppingListItem',
    ]);
  });

  it.each(keyedNames)('%s has the key in its input', name => {
    const input = inputTypeOf(operationNamed(name));

    expect(isInputObjectType(input) && input.getFields()).toHaveProperty(
      'idempotencyKey',
    );
  });

  it.each(keyedNames)('%s reads whether its answer converged', name => {
    const { selectionSet } = rootFieldOf(operationNamed(name));

    expect(selectionSet && selectsConverged(selectionSet)).toBe(true);
  });
});
