import { Kind, type DocumentNode, type OperationDefinitionNode } from 'graphql';
import {
  inputTypeNameOf,
  operationNameOf,
  rootFieldOf,
} from '../documentOperation';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { UpdateDietaryProfileDocument } from '#operations/user/user.generated';

const EMPTY: DocumentNode = { kind: Kind.DOCUMENT, definitions: [] };

// What the generated document itself declares, read straight off its AST.
const operationOf = (document: DocumentNode) =>
  document.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
  );

describe('documentOperation', () => {
  it.each([MoveShoppingListItemDocument, ForkRecipeDocument])(
    'reads the operation name the document declares',
    document => {
      expect(operationNameOf(document)).toBe(
        operationOf(document)?.name?.value,
      );
    },
  );

  it('throws for a document with no named operation', () => {
    expect(() => operationNameOf(EMPTY)).toThrow();
  });

  it('reads the named type under a non-null `$input`', () => {
    const [input] = operationOf(ForkRecipeDocument)?.variableDefinitions ?? [];
    const declared =
      input?.type.kind === Kind.NON_NULL_TYPE &&
      input.type.type.kind === Kind.NAMED_TYPE
        ? input.type.type.name.value
        : undefined;

    expect(declared).toBeDefined();
    expect(inputTypeNameOf(ForkRecipeDocument)).toBe(declared);
  });

  it.each([MoveShoppingListItemDocument, UpdateDietaryProfileDocument])(
    'reads the root field the operation selects',
    document => {
      const [first] = operationOf(document)?.selectionSet.selections ?? [];
      const declared =
        first?.kind === Kind.FIELD ? first.name.value : undefined;

      expect(declared).toBeDefined();
      expect(rootFieldOf(document)).toBe(declared);
    },
  );

  it('throws for a document that selects no root field', () => {
    expect(() => rootFieldOf(EMPTY)).toThrow();
  });

  it('has no input type for a document without `$input`', () => {
    expect(inputTypeNameOf(EMPTY)).toBeNull();
    expect(inputTypeNameOf(UpdateDietaryProfileDocument)).not.toBeNull();
  });
});
