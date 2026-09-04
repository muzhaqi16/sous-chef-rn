import { reconcileReplaySuccess } from '../queueReplayReconcilers';
import {
  addPantryItemLocally,
  removePantryItemLocally,
} from '#features/pantry/cache/items';

jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => ({ cache: {} }),
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
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
      'MoveShoppingItemToPantry',
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
    reconcileReplaySuccess(
      'MoveShoppingItemToPantry',
      variables,
      payloadWith('minted-1'),
    );

    expect(removePantryItemLocally).not.toHaveBeenCalled();
    expect(addPantryItemLocally).not.toHaveBeenCalled();
  });

  it('does nothing when the payload carries no pantry item', () => {
    // A refusal reaches here only if it was not classified as rejected; either
    // way there is no id to compare, so guessing would evict a live row.
    reconcileReplaySuccess('MoveShoppingItemToPantry', variables, {
      moveShoppingItemToPantry: {
        __typename: 'ForbiddenError',
        code: 'FORBIDDEN',
      },
    });

    expect(removePantryItemLocally).not.toHaveBeenCalled();
  });

  it('does nothing when the move minted no id', () => {
    reconcileReplaySuccess(
      'MoveShoppingItemToPantry',
      { input: { shoppingListItemId: 'sli-1', pantryId: 'pantry-1' } },
      payloadWith('existing-99'),
    );

    expect(removePantryItemLocally).not.toHaveBeenCalled();
  });

  it('has no reconciler for an ordinary replayed operation', () => {
    reconcileReplaySuccess('CreatePantryItem', variables, payloadWith('x'));

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
        'MoveShoppingItemToPantry',
        variables,
        payloadWith('existing-99'),
      ),
    ).not.toThrow();
  });
});
