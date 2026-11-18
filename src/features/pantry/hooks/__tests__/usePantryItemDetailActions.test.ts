import { act } from '@testing-library/react-native';

import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { seedPantry } from '#/test-utils/fixtures/pantryFixtures';
import { pantryItemData } from '#/test-utils/fixtures/pantryItemFixtures';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import { isRecord } from '#/utils/isRecord';
import {
  BatchStatus,
  ErrorCode,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import {
  AdjustPantryItemQuantityDocument,
  ConvertExpiredToWasteDocument,
  CorrectPantryItemPackageSizeDocument,
  DeletePantryItemDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import { GetPantryItemDocument } from '#features/pantry/screens/usePantryItemDetailData.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '../usePantryItemDetailActions.generated';
import { usePantryItemDetailActions } from '../usePantryItemDetailActions';

type Params = Parameters<typeof usePantryItemDetailActions>[0];

/** Three cups of milk in the first pantry, as the detail screen holds it. */
const milk = {
  id: 'item-1',
  pantryId: 'pantry-1',
  version: 1,
  quantity: 3,
  unit: { id: 'unit-1', name: 'cups', symbol: 'c' },
  item: { id: 'catalog-1' },
  itemName: 'Milk',
  activeBatchCount: 0,
};

const LISTED = gql`
  fragment DetailActionsTestListed on Pantry {
    stats {
      totalItems
    }
    itemsConnection(first: 50) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

/** The rows a pantry's list holds, the pending writes included. */
const listed = (cache: InMemoryCache, pantryId: string) =>
  cache
    .readFragment<{
      itemsConnection: { edges: { node: { id: string } }[] };
    }>({
      id: `Pantry:${pantryId}`,
      fragment: LISTED,
      optimistic: true,
    })
    ?.itemsConnection.edges.map(edge => edge.node.id);

/** How many rows a pantry counts, the pending writes included. */
const counted = (cache: InMemoryCache, pantryId: string) =>
  cache.readFragment<{ stats: { totalItems: number } }>({
    id: `Pantry:${pantryId}`,
    fragment: LISTED,
    optimistic: true,
  })?.stats.totalItems;

/** Milk listed in its pantry, beside a jar in another the user has selected. */
function stocked(owner = 'pantry-1') {
  const cache = makeCache();
  seedPantry(cache, {
    id: owner,
    items: [{ id: 'item-1', itemName: 'Milk' }],
  });
  seedPantry(cache, {
    id: 'pantry-other',
    items: [{ id: 'item-9', itemName: 'Jam' }],
  });
  seedQuery(cache, {
    query: GetPantryItemDocument,
    variables: { id: 'item-1' },
    data: pantryItemData({ id: 'item-1', itemName: 'Milk', quantity: 3 }),
  });
  return cache;
}

const deleted: MockDataFor<typeof DeletePantryItemDocument> = {
  deletePantryItem: {
    __typename: 'DeletePantryItemPayload',
    pantryItem: { id: 'item-1' },
  },
};

const added: MockDataFor<typeof AddItemToShoppingListFromPantryItemDocument> = {
  addItemsToShoppingList: {
    __typename: 'AddItemsToShoppingListPayload',
    results: [{ index: 0, success: true, failure: null }],
  },
};

let log = operationLog();

const goBack = jest.fn();
const needsList = jest.fn();

function renderActions(
  over: Partial<Params> = {},
  {
    cache = stocked(),
    answers = [],
  }: { cache?: InMemoryCache; answers?: ReturnType<typeof recordMock>[] } = {},
) {
  const params: Params = {
    itemId: 'item-1',
    item: milk,
    selectedPantryId: 'pantry-1',
    selectedShoppingListId: 'list-1',
    goBack,
    onAddToShoppingListNeedsList: needsList,
    ...over,
  };
  const { result } = renderHookWithApollo(
    () => usePantryItemDetailActions(params),
    {
      cache,
      links: [log.link],
      operationMocks: answers.map(answer => answer.mock),
    },
  );
  return { result, cache };
}

/** The last alert, as the user reads it: its title, body and buttons. */
const lastAlert = () => {
  const call = jest.mocked(alertService.alert).mock.calls.at(-1);
  if (!call) throw new Error('no alert was shown');
  const [title, body, buttons] = call;
  return { title, body, buttons };
};

/** Presses the destructive button of the last alert. */
const confirm = () => {
  const button = lastAlert().buttons?.find(b => b.style === 'destructive');
  if (!button?.onPress)
    throw new Error('the alert offers no destructive button');
  act(() => button.onPress?.());
};

/** The one line the add sends. */
const sentLine = (add: ReturnType<typeof recordMock>) => {
  const [vars] = add.fired;
  const input = vars && isRecord(vars.input) ? vars.input : {};
  const [line] = Array.isArray(input.items) ? input.items : [];
  return isRecord(line) ? line : {};
};

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
});

describe('deleting the stack', () => {
  it('asks first, naming the stack, and deletes nothing until confirmed', () => {
    const del = recordMock(DeletePantryItemDocument, { data: deleted });
    const { result } = renderActions({}, { answers: [del] });

    act(() => result.current.handleDelete());

    expect(lastAlert().title).toBe(t('labels.deleteNamed', { name: 'Milk' }));
    expect(del.fired).toEqual([]);
  });

  it('takes the row out of its list at once, and goes back once the server answers', async () => {
    const del = recordMock(DeletePantryItemDocument, {
      data: deleted,
      held: true,
    });
    const { result, cache } = renderActions({}, { answers: [del] });

    act(() => result.current.handleDelete());
    confirm();
    await log.requested(DeletePantryItemDocument);

    expect(del.fired).toEqual([{ input: { id: 'item-1' }, today: todayKey() }]);
    expect(listed(cache, 'pantry-1')).not.toContain('item-1');
    expect(goBack).not.toHaveBeenCalled();

    del.release();
    await log.landed(DeletePantryItemDocument);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  // A deep link or a notification can open a stack outside the selected pantry.
  it("takes it out of its own pantry's list, not the selected one", async () => {
    const del = recordMock(DeletePantryItemDocument, {
      data: deleted,
      held: true,
    });
    const { result, cache } = renderActions(
      {
        item: { ...milk, pantryId: 'pantry-own' },
        selectedPantryId: 'pantry-other',
      },
      { cache: stocked('pantry-own'), answers: [del] },
    );

    act(() => result.current.handleDelete());
    confirm();
    await log.requested(DeletePantryItemDocument);

    expect(listed(cache, 'pantry-own')).toEqual([]);
    expect(counted(cache, 'pantry-own')).toBe(0);
    expect(listed(cache, 'pantry-other')).toEqual(['item-9']);
    expect(counted(cache, 'pantry-other')).toBe(1);
  });

  it('deletes with no pantry selected, from the stack’s own', async () => {
    const del = recordMock(DeletePantryItemDocument, { data: deleted });
    const { result } = renderActions(
      { selectedPantryId: null },
      { answers: [del] },
    );

    act(() => result.current.handleDelete());
    confirm();
    await log.landed(DeletePantryItemDocument);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('does not pretend to delete when no pantry can be found at all', () => {
    const del = recordMock(DeletePantryItemDocument, { data: deleted });
    const { result } = renderActions(
      { selectedPantryId: null, item: { ...milk, pantryId: null } },
      { answers: [del] },
    );

    act(() => result.current.handleDelete());
    confirm();

    expect(lastAlert().title).toBe(t('labels.error'));
    expect(del.fired).toEqual([]);
    expect(goBack).not.toHaveBeenCalled();
  });

  it('returns to the list when another member deleted it first', async () => {
    const converged = recordMock(DeletePantryItemDocument, {
      data: {
        deletePantryItem: {
          __typename: 'DeletePantryItemPayload',
          converged: true,
          pantryItem: null,
        },
      },
    });
    const { result } = renderActions({}, { answers: [converged] });

    act(() => result.current.handleDelete());
    confirm();
    await log.landed(DeletePantryItemDocument);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('says so, stays, and keeps the row when the server refuses', async () => {
    const refused = recordMock(DeletePantryItemDocument, {
      data: {
        deletePantryItem: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not yours',
        },
      },
    });
    const { result, cache } = renderActions({}, { answers: [refused] });

    act(() => result.current.handleDelete());
    confirm();
    await log.landed(DeletePantryItemDocument);

    expect(lastAlert().title).toBe(t('labels.error'));
    expect(goBack).not.toHaveBeenCalled();
    expect(listed(cache, 'pantry-1')).toContain('item-1');
  });
});

describe('adding it to the shopping list', () => {
  it('asks for a list when none is chosen', async () => {
    const { result } = renderActions({ selectedShoppingListId: null });

    await act(() => result.current.handleAddToShoppingList());

    expect(needsList).toHaveBeenCalledTimes(1);
  });

  it('adds its catalog item, amount and unit to the chosen list', async () => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
    });
    const { result } = renderActions({}, { answers: [add] });

    await act(() => result.current.handleAddToShoppingList());

    expect(add.fired).toEqual([
      {
        input: {
          shoppingListId: 'list-1',
          items: [
            {
              // Client-minted, so a queued create replays as itself.
              id: expect.any(String),
              item: { itemId: 'catalog-1' },
              quantity: 3,
              unit: { id: 'unit-1' },
            },
          ],
        },
      },
    ]);
    expect(result.current.addToListStatus).toBe('success');
  });

  it('names a stack with no catalog item by its name', async () => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
    });
    const { result } = renderActions(
      { item: { ...milk, item: null } },
      { answers: [add] },
    );

    await act(() => result.current.handleAddToShoppingList());

    expect(sentLine(add).item).toEqual({
      inline: { id: expect.any(String), name: 'Milk' },
    });
  });

  it.each([
    { what: 'an empty stack', quantity: 0 },
    { what: 'a stack with no amount', quantity: null },
  ])('adds one of $what', async ({ quantity }) => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
    });
    const { result } = renderActions(
      { item: { ...milk, quantity } },
      { answers: [add] },
    );

    await act(() => result.current.handleAddToShoppingList());

    expect(sentLine(add).quantity).toBe(1);
  });

  it('sends no unit for a stack with none', async () => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
    });
    const { result } = renderActions(
      { item: { ...milk, unit: null } },
      { answers: [add] },
    );

    await act(() => result.current.handleAddToShoppingList());

    expect(sentLine(add).unit).toBeUndefined();
  });

  it('adds it once however often it is tapped while adding', async () => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
      held: true,
    });
    const { result } = renderActions({}, { answers: [add] });

    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.handleAddToShoppingList();
    });
    await log.requested(AddItemToShoppingListFromPantryItemDocument);
    await act(() => result.current.handleAddToShoppingList());
    add.release();
    await act(async () => {
      await first;
    });

    expect(add.fired).toHaveLength(1);
  });

  it('says so, and marks the add failed, when the list refuses it', async () => {
    const refused = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not yours',
        },
      },
    });
    const { result } = renderActions({}, { answers: [refused] });

    await act(() => result.current.handleAddToShoppingList());

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(result.current.addToListStatus).toBe('error');
  });

  it('keeps a queued add without an alert', async () => {
    const queued = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: { addItemsToShoppingList: null },
      partial: true,
    });
    const { result } = renderActions({}, { answers: [queued] });

    await act(() => result.current.handleAddToShoppingList());

    expect(alertService.alert).not.toHaveBeenCalled();
    expect(result.current.addToListStatus).toBe('success');
  });

  it("names the new row's unit", async () => {
    const add = recordMock(AddItemToShoppingListFromPantryItemDocument, {
      data: added,
      held: true,
    });
    const { result, cache } = renderActions({}, { answers: [add] });

    act(() => {
      void result.current.handleAddToShoppingList();
    });
    await log.requested(AddItemToShoppingListFromPantryItemDocument);

    const row = cache.readFragment<{ unitName: string | null }>({
      id: `ShoppingListItem:${String(sentLine(add).id)}`,
      fragment: gql`
        fragment DetailActionsTestRow on ShoppingListItem {
          unitName
        }
      `,
      optimistic: true,
    });
    expect(row?.unitName).toBe('c');
  });
});

describe('discarding what expired', () => {
  it.each([
    {
      held: 'in batches',
      activeBatchCount: 2,
      title: () => t('pantryItemDetail.discardBatchesTitle'),
    },
    {
      held: 'whole',
      activeBatchCount: 0,
      title: () => t('pantryItemDetail.discardItemTitle'),
    },
  ])(
    'asks before discarding a stack held $held',
    ({ activeBatchCount, title }) => {
      const { result } = renderActions({ item: { ...milk, activeBatchCount } });

      act(() => result.current.handleDiscardExpired());

      expect(lastAlert().title).toBe(title());
    },
  );

  it.each([
    {
      unit: 'a fraction',
      displayAsFraction: true,
      quantity: 1.25,
      read: '1 1/4 c',
    },
    {
      unit: 'decimals',
      displayAsFraction: false,
      quantity: 1.3333334,
      read: '1.333 c',
    },
  ])(
    'names what is left in a unit read in $unit',
    ({ displayAsFraction, quantity, read }) => {
      const { result } = renderActions({
        item: { ...milk, quantity, unit: { ...milk.unit, displayAsFraction } },
      });

      act(() => result.current.handleDiscardExpired());

      expect(lastAlert().body).toContain(read);
    },
  );

  it.each([
    {
      held: 'in batches',
      activeBatchCount: 2,
      toast: () => t('success.expiredBatchesDiscarded'),
    },
    {
      held: 'whole',
      activeBatchCount: 0,
      toast: () => t('success.expiredItemDiscarded'),
    },
  ])(
    'discards a stack held $held once confirmed, and says so',
    async ({ activeBatchCount, toast }) => {
      const convert = recordMock(ConvertExpiredToWasteDocument, {
        data: {
          convertExpiredToWaste: {
            __typename: 'ConvertExpiredToWastePayload',
            pantryItem: { id: 'item-1' },
          },
        },
      });
      const { result } = renderActions(
        { item: { ...milk, activeBatchCount } },
        { answers: [convert] },
      );

      act(() => result.current.handleDiscardExpired());
      confirm();
      await log.landed(ConvertExpiredToWasteDocument);

      expect(convert.fired).toEqual([
        expect.objectContaining({
          input: expect.objectContaining({ pantryItemId: 'item-1' }),
        }),
      ]);
      expect(toastService.success).toHaveBeenCalledWith(toast());
    },
  );

  it('says nothing was discarded when the server refuses', async () => {
    const refused = recordMock(ConvertExpiredToWasteDocument, {
      data: {
        convertExpiredToWaste: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not yours',
        },
      },
    });
    const { result } = renderActions({}, { answers: [refused] });

    act(() => result.current.handleDiscardExpired());
    confirm();
    await log.landed(ConvertExpiredToWasteDocument);

    expect(toastService.success).not.toHaveBeenCalled();
  });
});

describe('a recount', () => {
  it('sets what is left at the version the stack was read at', async () => {
    const adjust = recordMock(AdjustPantryItemQuantityDocument, { held: true });
    const { result } = renderActions({}, { answers: [adjust] });

    act(() => result.current.handleConfirmAdjust(5, 'used some', 250));
    await log.requested(AdjustPantryItemQuantityDocument);

    expect(adjust.fired).toEqual([
      {
        today: todayKey(),
        input: {
          id: 'item-1',
          newQuantity: 5,
          reason: 'used some',
          idempotencyKey: expect.any(String),
          version: 1,
          remainingNetWeight: 250,
        },
      },
    ]);
  });

  it('sends the unit a recount was typed in', async () => {
    const adjust = recordMock(AdjustPantryItemQuantityDocument, { held: true });
    const { result } = renderActions({}, { answers: [adjust] });

    act(() =>
      result.current.handleConfirmAdjust(2.5, 'recount', undefined, {
        newQuantityUnitId: 'unit-lb',
      }),
    );
    await log.requested(AdjustPantryItemQuantityDocument);

    expect(adjust.fired[0]).toMatchObject({
      input: { newQuantityUnitId: 'unit-lb' },
    });
  });
});

describe('correcting a package size', () => {
  const correction = {
    amount: 22,
    unitId: 'unit-oz',
    unitType: UnitType.Weight,
    reason: 'label misread',
  };

  const withBatch = () => {
    const cache = stocked();
    seedQuery(cache, {
      query: GetPantryItemBatchesDocument,
      variables: { pantryItemId: 'item-1' },
      data: {
        pantryItemBatchesConnection: {
          edges: [
            {
              node: {
                __typename: 'PantryItemBatch',
                id: 'batch-1',
                status: BatchStatus.Active,
              },
            },
          ],
        },
      },
    });
    return cache;
  };

  it('corrects the batch being corrected, on this stack', async () => {
    const correct = recordMock(CorrectPantryItemPackageSizeDocument, {
      data: {
        correctPantryItemPackageSize: {
          __typename: 'CorrectPantryItemPackageSizePayload',
        },
      },
    });
    const { result } = renderActions(
      {},
      { cache: withBatch(), answers: [correct] },
    );
    act(() => result.current.setCorrectingBatchId('batch-1'));

    let refusal: string | null | undefined;
    await act(async () => {
      refusal = await result.current.handleCorrectPackageSize(correction);
    });

    expect(refusal).toBeNull();
    expect(correct.fired).toEqual([
      {
        today: todayKey(),
        input: expect.objectContaining({
          batchId: 'batch-1',
          correction: {
            packageSize: { netWeight: 22, netWeightUnitId: 'unit-oz' },
          },
          reason: 'label misread',
        }),
      },
    ]);
  });

  it('corrects nothing when no batch is being corrected', async () => {
    const correct = recordMock(CorrectPantryItemPackageSizeDocument, {});
    const { result } = renderActions(
      {},
      { cache: withBatch(), answers: [correct] },
    );

    await act(async () => {
      await result.current.handleCorrectPackageSize(correction);
    });

    expect(correct.fired).toEqual([]);
  });
});
