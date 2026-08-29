import { reconcileReplaySuccess } from '../queueReplayReconcilers';
import {
  adjustPantryItemCount,
  removeFromPantryItemsCache,
} from '#/apollo/utils/pantryCacheUpdaters';

jest.mock('#/apollo/client', () => ({ client: { cache: {} } }));
jest.mock('#/apollo/utils/pantryCacheUpdaters', () => ({
  adjustPantryItemCount: jest.fn(),
  removeFromPantryItemsCache: jest.fn(),
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

    expect(removeFromPantryItemsCache).toHaveBeenCalledWith(
      {},
      'pantry-1',
      'minted-1',
    );
    expect(adjustPantryItemCount).toHaveBeenCalledWith({}, 'pantry-1', -1);
  });

  it('leaves the row alone when the server used the minted id', () => {
    reconcileReplaySuccess(
      'MoveShoppingItemToPantry',
      variables,
      payloadWith('minted-1'),
    );

    expect(removeFromPantryItemsCache).not.toHaveBeenCalled();
    expect(adjustPantryItemCount).not.toHaveBeenCalled();
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

    expect(removeFromPantryItemsCache).not.toHaveBeenCalled();
  });

  it('does nothing when the move minted no id', () => {
    reconcileReplaySuccess(
      'MoveShoppingItemToPantry',
      { input: { shoppingListItemId: 'sli-1', pantryId: 'pantry-1' } },
      payloadWith('existing-99'),
    );

    expect(removeFromPantryItemsCache).not.toHaveBeenCalled();
  });

  it('has no reconciler for an ordinary replayed operation', () => {
    reconcileReplaySuccess('CreatePantryItem', variables, payloadWith('x'));

    expect(removeFromPantryItemsCache).not.toHaveBeenCalled();
    expect(adjustPantryItemCount).not.toHaveBeenCalled();
  });

  it('never lets a reconciliation failure escape into the replay', () => {
    // A throw here would be classified as a queue failure, and the failure
    // handler would then WITHDRAW a change the server had accepted.
    (removeFromPantryItemsCache as jest.Mock).mockImplementation(() => {
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
