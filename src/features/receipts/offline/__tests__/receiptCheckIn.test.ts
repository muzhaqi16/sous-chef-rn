import { InMemoryCache } from '@apollo/client';
import {
  reconcileCreatedPantryItem,
  removePantryItemLocally,
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import {
  applyMoveToPantryCacheUpdate,
  revertLocalMove,
} from '#features/shoppingList/cache/localMove';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import {
  applyReceiptCheckIn,
  reconcileReceiptCheckInReplay,
  restoreReceiptCheckInListLines,
  withdrawReceiptCheckIn,
} from '../receiptCheckIn';

jest.mock('#features/pantry/cache/items');
jest.mock('#features/shoppingList/cache/localMove');
jest.mock('#features/shoppingList/cache/purchase');

const cache = new InMemoryCache();

const INPUT = {
  id: 'checkin-1',
  pantryId: 'pantry-1',
  shoppingListId: 'list-1',
  lines: [
    { pantryItemId: 'pi-0' },
    { pantryItemId: 'pi-1', shoppingListItemId: 'line-eggs' },
    { pantryItemId: 'pi-2' },
    {},
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(revertLocalMove).mockReturnValue(true);
});

describe('applyReceiptCheckIn', () => {
  it('keeps a new stack under its minted id', () => {
    applyReceiptCheckIn(cache, INPUT, [
      { index: 0, success: true, pantryItem: { id: 'pi-0' } },
    ]);

    expect(reconcileCreatedPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      { __typename: 'PantryItem', id: 'pi-0' },
      'pi-0',
    );
  });

  it('swaps a restocked line onto the held stack, and reports the merge', () => {
    const { adopted } = applyReceiptCheckIn(cache, INPUT, [
      { index: 2, success: true, pantryItem: { id: 'held-stack' } },
    ]);

    expect(reconcileCreatedPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      { __typename: 'PantryItem', id: 'held-stack' },
      'pi-2',
    );
    expect(adopted).toEqual([
      { mintedId: 'pi-2', survivingId: 'held-stack', version: undefined },
    ]);
  });

  it('settles a listed line as a move that keeps it on the list', () => {
    applyReceiptCheckIn(cache, INPUT, [
      { index: 1, success: true, pantryItem: { id: 'pi-1' } },
    ]);

    expect(applyMoveToPantryCacheUpdate).toHaveBeenCalledWith(cache, {
      pantryId: 'pantry-1',
      shoppingListItemId: 'line-eggs',
      removeFromList: false,
      currentListId: 'list-1',
      pantryItem: { __typename: 'PantryItem', id: 'pi-1' },
      clientId: 'pi-1',
    });
    expect(reconcileCreatedPantryItem).not.toHaveBeenCalled();
  });

  it('withdraws only the refused line, exactly, from what it wrote', () => {
    const written = new Map([
      [0, { kind: 'intake' as const }],
      [1, { kind: 'move' as const, written: { keptStamp: undefined } }],
    ]);
    const { exact } = applyReceiptCheckIn(
      cache,
      INPUT,
      [
        { index: 0, success: false, failure: { code: 'VALIDATION_FAILED' } },
        { index: 1, success: false, failure: { code: 'FORBIDDEN' } },
        { index: 2, success: true, pantryItem: { id: 'pi-2' } },
      ],
      written,
    );

    expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      'pi-0',
    );
    expect(revertLocalMove).toHaveBeenCalledWith(
      cache,
      {
        pantryId: 'pantry-1',
        pantryItemId: 'pi-1',
        shoppingListItemId: 'line-eggs',
        removeFromList: false,
      },
      written.get(1)?.kind === 'move' ? written.get(1)?.written : undefined,
    );
    expect(reconcileCreatedPantryItem).toHaveBeenCalledTimes(1);
    expect(exact).toBe(true);
  });

  it('un-stamps a refused list line it cannot undo exactly, and says so', () => {
    const { exact } = applyReceiptCheckIn(cache, INPUT, [
      { index: 1, success: false, failure: { code: 'FORBIDDEN' } },
    ]);

    expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      'pi-1',
    );
    expect(writePurchaseInfo).toHaveBeenCalledWith(cache, 'line-eggs', {
      movedToPantryAt: null,
    });
    expect(exact).toBe(false);
  });

  it('writes nothing for a stock-free line the API recorded', () => {
    applyReceiptCheckIn(cache, INPUT, [{ index: 3, success: true }]);

    expect(reconcileCreatedPantryItem).not.toHaveBeenCalled();
    expect(applyMoveToPantryCacheUpdate).not.toHaveBeenCalled();
  });
});

describe('a queued check-in', () => {
  const data = {
    createReceiptCheckIn: {
      __typename: 'CreateReceiptCheckInPayload',
      results: [
        { index: 0, success: true, pantryItem: { id: 'held-stack' } },
        {
          index: 2,
          success: false,
          failure: { code: 'VALIDATION_FAILED' },
          pantryItem: null,
        },
      ],
    },
  };

  beforeEach(() => {
    useReceiptDraftStore.setState({ draft: null });
    seedDraft();
    useReceiptDraftStore.getState().ensureCheckInIds([0, 2], 1);
  });

  const queuedInput = () => ({
    ...INPUT,
    id: useReceiptDraftStore.getState().draft?.checkIn?.ids[0],
  });

  it('settles on replay as in the foreground, and moves writes to a merged stack', () => {
    const adopt = jest.fn();
    reconcileReceiptCheckInReplay(cache, { input: queuedInput() }, data, adopt);

    expect(reconcileCreatedPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      { __typename: 'PantryItem', id: 'held-stack' },
      'pi-0',
    );
    expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
      cache,
      'pantry-1',
      'pi-2',
    );
    expect(adopt).toHaveBeenCalledWith({
      mintedId: 'pi-0',
      survivingId: 'held-stack',
      version: undefined,
    });
  });

  it('tells the saved receipt which lines landed', () => {
    reconcileReceiptCheckInReplay(cache, { input: queuedInput() }, data);

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.added).toEqual([0]);
    expect(draft?.failed).toEqual({ 2: 'VALIDATION_FAILED' });
    expect(draft?.checkIn?.state).toBe('idle');
  });

  it('leaves a newer receipt alone', () => {
    reconcileReceiptCheckInReplay(
      cache,
      { input: { ...INPUT, id: 'an-older-check-in' } },
      data,
    );

    expect(useReceiptDraftStore.getState().draft?.added).toBeUndefined();
  });

  it('withdraws every stack and list stamp when refused for good', () => {
    withdrawReceiptCheckIn(cache, { input: INPUT }, null);
    restoreReceiptCheckInListLines(cache, { input: INPUT });

    expect(jest.mocked(removePantryItemLocally).mock.calls).toEqual([
      [cache, 'pantry-1', 'pi-0'],
      [cache, 'pantry-1', 'pi-1'],
      [cache, 'pantry-1', 'pi-2'],
    ]);
    expect(writePurchaseInfo).toHaveBeenCalledWith(cache, 'line-eggs', {
      movedToPantryAt: null,
    });
  });
});
