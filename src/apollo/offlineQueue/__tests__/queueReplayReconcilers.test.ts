import { reconcileReplaySuccess } from '../queueReplayReconcilers';
import {
  addPantryItemLocally,
  removePantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  CreatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  AddItemToShoppingListDocument,
  CreateShoppingListDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';

jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => ({ cache: {} }),
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));
jest.mock('#features/shoppingList/cache/connections', () => ({
  ...jest.requireActual('#features/shoppingList/cache/connections'),
  addNewItemToShoppingListCache: jest.fn(),
}));
jest.mock('#features/pantry/cache/items', () => ({
  ...jest.requireActual('#features/pantry/cache/items'),
  addPantryItemLocally: jest.fn(),
  removePantryItemLocally: jest.fn(),
  revertOptimisticPantryItem: jest.fn(),
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
      { countsSettled: false },
    );
    // Withdrawing the ghost is only half of it. The foreground path also links
    // the row the server returned; without this the user is left with neither.
    expect(addPantryItemLocally).toHaveBeenCalledWith(
      {},
      'pantry-1',
      { __typename: 'PantryItem', id: 'existing-99' },
      { countsSettled: false },
    );
  });

  it("moves no count when the response stated the pantry's", () => {
    // The server row is usually already listed, so its link is a no-op and a
    // relative withdrawal would take one off the server's count.
    reconcileReplaySuccess(moveOperation, variables, {
      moveShoppingItemToPantry: {
        ...payloadWith('existing-99').moveShoppingItemToPantry,
        pantry: { id: 'pantry-1', stats: { totalItems: 7 } },
      },
    });

    expect(removePantryItemLocally).toHaveBeenCalledWith(
      {},
      'pantry-1',
      'minted-1',
      { countsSettled: true },
    );
    expect(addPantryItemLocally).toHaveBeenCalledWith(
      {},
      'pantry-1',
      { __typename: 'PantryItem', id: 'existing-99' },
      { countsSettled: true },
    );
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
      operationNameOf(UpdatePantryItemQuantityDocument),
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
describe('reconcileReplaySuccess — the shopping adds', () => {
  const merged = {
    addItemsToShoppingList: {
      __typename: 'AddItemsToShoppingListPayload',
      results: [
        {
          index: 0,
          success: true,
          item: { id: 'row-held', version: 3 },
        },
      ],
    },
  };

  it.each([
    AddItemToShoppingListDocument,
    AddItemsToShoppingListFromRecipeDocument,
  ])(
    'moves the writes behind a merged line onto the row the server kept (%#)',
    document => {
      const adopt = jest.fn();

      reconcileReplaySuccess(
        operationNameOf(document),
        { input: { shoppingListId: 'list-1', items: [{ id: 'minted-1' }] } },
        merged,
        adopt,
      );

      expect(adopt).toHaveBeenCalledWith({
        mintedId: 'minted-1',
        survivingId: 'row-held',
        version: 3,
      });
    },
  );

  it('moves the writes behind a list created with a merged line', () => {
    const adopt = jest.fn();

    reconcileReplaySuccess(
      operationNameOf(CreateShoppingListDocument),
      { input: { id: 'list-1', items: [{ id: 'minted-1' }] } },
      {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          itemResults: merged.addItemsToShoppingList.results,
        },
      },
      adopt,
    );

    expect(adopt).toHaveBeenCalledTimes(1);
  });
});

/**
 * A queued pantry create replays with `forceAdd`, so a stack another member
 * added meanwhile absorbs it and comes back under ITS id. The minted row is
 * then a second row for the same stack.
 */
describe('reconcileReplaySuccess — a queued pantry create joining a held stack', () => {
  const replayed = {
    input: { id: 'minted-1', pantryId: 'pantry-1', forceAdd: true },
  };
  const answer = (id: string) => ({
    createPantryItem: {
      __typename: 'CreatePantryItemPayload',
      outcome: id === 'minted-1' ? 'CREATED' : 'MERGED',
      pantryItem: { __typename: 'PantryItem', id, version: 4 },
    },
  });

  beforeEach(() => jest.clearAllMocks());

  it('swaps the minted row for the held stack', () => {
    const adopt = jest.fn();
    reconcileReplaySuccess(
      operationNameOf(CreatePantryItemDocument),
      replayed,
      answer('held-9'),
      adopt,
    );

    expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
      {},
      'pantry-1',
      'minted-1',
      { countsSettled: false },
    );
    expect(addPantryItemLocally).toHaveBeenCalledWith(
      {},
      'pantry-1',
      { __typename: 'PantryItem', id: 'held-9' },
      { countsSettled: false },
    );
    // Writes still queued against the minted id move to the held stack.
    expect(adopt).toHaveBeenCalledWith({
      mintedId: 'minted-1',
      survivingId: 'held-9',
      version: 4,
    });
  });

  it('leaves a row the server created under the minted id', () => {
    reconcileReplaySuccess(
      operationNameOf(CreatePantryItemDocument),
      replayed,
      answer('minted-1'),
    );

    expect(revertOptimisticPantryItem).not.toHaveBeenCalled();
    expect(addPantryItemLocally).not.toHaveBeenCalled();
  });
});
