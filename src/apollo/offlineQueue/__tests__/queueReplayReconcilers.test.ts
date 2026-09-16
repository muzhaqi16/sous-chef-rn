import { reconcileReplaySuccess } from '../queueReplayReconcilers';
import {
  addPantryItemLocally,
  removePantryItemLocally,
} from '#features/pantry/cache/items';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { revertOptimisticShoppingListItem } from '#features/shoppingList/cache/items';

jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => ({ cache: {} }),
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));
jest.mock('#features/shoppingList/cache/items', () => ({
  revertOptimisticShoppingListItem: jest.fn(),
}));
jest.mock('#features/pantry/cache/items', () => ({
  addPantryItemLocally: jest.fn(),
  removePantryItemLocally: jest.fn(),
}));

/**
 * `moveShoppingItemToPantry`'s `pantryItemId` is a HINT, honoured only when the
 * move CREATES a row. When the pantry already stocks that catalog item the
 * server restocks the existing stack and returns ITS id instead — so the row
 * written under the minted id is a ghost that 404s when tapped.
 *
 * `useMoveToPantry` compares the two on the foreground path. A queued move
 * cannot: it classified as `'queued'` and returned before the replay ever
 * happened, so the comparison has to run again where the replay lands.
 */
describe('reconcileReplaySuccess — MoveShoppingItemToPantry', () => {
  const moveOperation = operationNameOf(MoveShoppingItemToPantryDocument);
  const variables = {
    input: {
      shoppingListItemId: 'sli-1',
      pantryId: 'pantry-1',
      pantryItemId: 'minted-1',
    },
  };
  const payloadWith = (id: string) => ({
    moveShoppingItemToPantry: {
      __typename: 'MoveShoppingItemToPantryPayload',
      pantryItem: { __typename: 'PantryItem', id },
    },
  });

  beforeEach(() => jest.clearAllMocks());

  it('withdraws the ghost when the server restocked a different row', () => {
    reconcileReplaySuccess(
      moveOperation,
      variables,
      payloadWith('existing-99'),
    );

    expect(removePantryItemLocally).toHaveBeenCalledWith(
      {},
      'pantry-1',
      'minted-1',
    );
    // Withdrawing the ghost is only half of it. The foreground path also links
    // the row the server returned; without this the user is left with neither.
    expect(addPantryItemLocally).toHaveBeenCalledWith({}, 'pantry-1', {
      __typename: 'PantryItem',
      id: 'existing-99',
    });
  });

  it('leaves the row alone when the server used the minted id', () => {
    reconcileReplaySuccess(moveOperation, variables, payloadWith('minted-1'));

    expect(removePantryItemLocally).not.toHaveBeenCalled();
    expect(addPantryItemLocally).not.toHaveBeenCalled();
  });

  it('does nothing when the payload carries no pantry item', () => {
    // A refusal reaches here only if it was not classified as rejected; either
    // way there is no id to compare, so guessing would evict a live row.
    reconcileReplaySuccess(moveOperation, variables, {
      moveShoppingItemToPantry: {
        __typename: 'ForbiddenError',
        code: 'FORBIDDEN',
      },
    });

    expect(removePantryItemLocally).not.toHaveBeenCalled();
  });

  it('does nothing when the move minted no id', () => {
    reconcileReplaySuccess(
      moveOperation,
      { input: { shoppingListItemId: 'sli-1', pantryId: 'pantry-1' } },
      payloadWith('existing-99'),
    );

    expect(removePantryItemLocally).not.toHaveBeenCalled();
  });

  it('has no reconciler for an ordinary replayed operation', () => {
    reconcileReplaySuccess(
      operationNameOf(CreatePantryItemDocument),
      variables,
      payloadWith('x'),
    );

    expect(removePantryItemLocally).not.toHaveBeenCalled();
    expect(addPantryItemLocally).not.toHaveBeenCalled();
  });

  it('never lets a reconciliation failure escape into the replay', () => {
    // A throw here would be classified as a queue failure, and the failure
    // handler would then WITHDRAW a change the server had accepted.
    (removePantryItemLocally as jest.Mock).mockImplementation(() => {
      throw new Error('cache exploded');
    });

    expect(() =>
      reconcileReplaySuccess(
        moveOperation,
        variables,
        payloadWith('existing-99'),
      ),
    ).not.toThrow();
  });
});

/**
 * A multi-row batch replays as itself, and the server can accept the batch
 * while refusing some of its rows inside `results`. Each refused row was shown
 * locally and has nothing left to send it, so it is withdrawn; the rest stay.
 */
describe('reconcileReplaySuccess — AddItemToShoppingList batch', () => {
  const addOperation = operationNameOf(AddItemToShoppingListDocument);
  const variables = {
    input: {
      shoppingListId: 'list-1',
      items: [{ id: 'row-a' }, { id: 'row-b' }],
    },
  };

  beforeEach(() => jest.clearAllMocks());

  it('withdraws only the rows the server refused inside the batch', () => {
    reconcileReplaySuccess(addOperation, variables, {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [{ success: true }, { success: false }],
      },
    });

    expect(revertOptimisticShoppingListItem).toHaveBeenCalledTimes(1);
    expect(revertOptimisticShoppingListItem).toHaveBeenCalledWith(
      {},
      'list-1',
      'row-b',
    );
  });

  it('leaves a single-row replay, answered in the sync shape, alone', () => {
    reconcileReplaySuccess(addOperation, variables, {
      syncShoppingListItem: { __typename: 'SyncShoppingListItemPayload' },
    });

    expect(revertOptimisticShoppingListItem).not.toHaveBeenCalled();
  });
});
