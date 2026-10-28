import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  HeldStacksDocument,
  UseHeldStacks_PantryFragmentDoc,
  UseHeldStacks_PantryItemFragmentDoc,
  type UseHeldStacks_PantryFragment,
} from '../useHeldStacks.generated';
import { useHeldStacks, type HeldStack } from '../useHeldStacks';

type Row = UseHeldStacks_PantryFragment['itemsConnection']['edges'][number];

const PANTRY = 'pantry-1';
const OATS = 'item-oats';

const reading = (
  value: number,
  unitId: string,
  type: UnitType,
): HeldStack['held']['metric'] => ({
  __typename: 'MeasureReading',
  value,
  unitId,
  symbol: unitId,
  displayAsFraction: false,
  type,
});

const stack = (
  id: string,
  unit: { id: string; type: UnitType },
  createdAt: string,
  itemId = OATS,
): HeldStack => ({
  __typename: 'PantryItem',
  id,
  createdAt,
  item: { __typename: 'Item', id: itemId },
  unit: { __typename: 'Unit', ...unit, displayAsFraction: false },
  displayAmount: {
    __typename: 'DisplayAmount',
    quantity: 2,
    unit: { __typename: 'Unit', id: unit.id, symbol: unit.id },
  },
  held: {
    __typename: 'Measure',
    value: 2,
    unitId: unit.id,
    metric: reading(2, unit.id, unit.type),
    imperial: reading(2, unit.id, unit.type),
  },
});

const BAG = { id: 'u-bag', type: UnitType.Count };
const GRAMS = { id: 'u-g', type: UnitType.Weight };

function writeStack(cache: ReturnType<typeof makeCache>, row: HeldStack) {
  cache.writeFragment({
    fragment: UseHeldStacks_PantryItemFragmentDoc,
    fragmentName: 'useHeldStacks_pantryItem',
    data: row,
  });
}

/** Client mode: every row under the unfiltered connection. */
function writeRows(
  cache: ReturnType<typeof makeCache>,
  rows: { id: string; itemId: string }[],
) {
  cache.writeFragment({
    fragment: UseHeldStacks_PantryFragmentDoc,
    fragmentName: 'useHeldStacks_pantry',
    variables: {
      itemsFirst: undefined,
      itemsCursor: undefined,
      itemsFilter: undefined,
      itemsOrderBy: undefined,
    },
    data: {
      __typename: 'Pantry',
      id: PANTRY,
      itemsConnection: {
        __typename: 'PantryItemConnection',
        edges: rows.map(
          ({ id, itemId }): Row => ({
            __typename: 'PantryItemEdge',
            node: {
              __typename: 'PantryItem',
              id,
              item: { __typename: 'Item', id: itemId },
            },
          }),
        ),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });
}

describe('useHeldStacks', () => {
  it('follows the pantry as a stack of the item is written', async () => {
    const cache = makeCache();
    writeRows(cache, [{ id: 'other', itemId: 'item-rice' }]);
    writeStack(
      cache,
      stack('other', BAG, '2026-01-01T00:00:00.000Z', 'item-rice'),
    );
    const { result } = renderHookWithApollo(() => useHeldStacks(PANTRY, OATS), {
      cache,
      operationMocks: [],
    });

    expect(result.current.seedUnit).toBeNull();

    act(() => {
      writeStack(cache, stack('oats-bag', BAG, '2026-02-01T00:00:00.000Z'));
      writeRows(cache, [
        { id: 'other', itemId: 'item-rice' },
        { id: 'oats-bag', itemId: OATS },
      ]);
    });

    await waitFor(() =>
      expect(result.current.seedUnit).toEqual({
        id: 'u-bag',
        type: UnitType.Count,
      }),
    );
    expect(result.current.joinedIn('u-bag')?.id).toBe('oats-bag');
  });

  it('asks for the item’s stacks when the pantry keeps its rows by filter', async () => {
    const cache = makeCache();
    const asked = recordMock(HeldStacksDocument, {
      data: {
        pantry: {
          id: PANTRY,
          itemsConnection: {
            edges: [
              { node: stack('oats-g', GRAMS, '2026-01-01T00:00:00.000Z') },
            ],
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useHeldStacks(PANTRY, OATS), {
      cache,
      operationMocks: [asked.mock],
    });

    expect(result.current.seedUnit).toBeNull();
    await waitFor(() => expect(result.current.seedUnit).not.toBeNull());
    expect(asked.fired).toEqual([
      { pantryId: PANTRY, itemId: OATS, stacksFirst: 20 },
    ]);
    expect(result.current.seedUnit).toEqual({
      id: 'u-g',
      type: UnitType.Weight,
    });
  });

  it('leads with a counted stack, and joins the oldest in the add’s unit, else the oldest', () => {
    const cache = makeCache();
    writeStack(cache, stack('grams-old', GRAMS, '2026-01-01T00:00:00.000Z'));
    writeStack(cache, stack('bag-new', BAG, '2026-03-01T00:00:00.000Z'));
    writeStack(cache, stack('bag-old', BAG, '2026-02-01T00:00:00.000Z'));
    writeRows(cache, [
      { id: 'grams-old', itemId: OATS },
      { id: 'bag-new', itemId: OATS },
      { id: 'bag-old', itemId: OATS },
    ]);
    const { result } = renderHookWithApollo(() => useHeldStacks(PANTRY, OATS), {
      cache,
      operationMocks: [],
    });

    expect(result.current.seedUnit).toEqual({
      id: 'u-bag',
      type: UnitType.Count,
    });
    expect(result.current.joinedIn('u-bag')?.id).toBe('bag-old');
    expect(result.current.joinedIn('u-lb')?.id).toBe('grams-old');
  });

  // Strict, as a list cell: a row missing a field names neither the unit nor
  // the amount, so the two can never come from different stacks.
  it('skips a stack whose cached row is incomplete for both', () => {
    const cache = makeCache();
    writeStack(cache, stack('grams', GRAMS, '2026-01-01T00:00:00.000Z'));
    writeRows(cache, [
      { id: 'bag-partial', itemId: OATS },
      { id: 'grams', itemId: OATS },
    ]);
    const { result } = renderHookWithApollo(() => useHeldStacks(PANTRY, OATS), {
      cache,
      operationMocks: [],
    });

    expect(result.current.seedUnit).toEqual({
      id: 'u-g',
      type: UnitType.Weight,
    });
    expect(result.current.joinedIn('u-bag')?.id).toBe('grams');
  });

  it('names nothing with no pantry', () => {
    const { result } = renderHookWithApollo(() => useHeldStacks(null, OATS), {
      operationMocks: [],
    });

    expect(result.current.seedUnit).toBeNull();
    expect(result.current.joinedIn('u-bag')).toBeNull();
  });
});
