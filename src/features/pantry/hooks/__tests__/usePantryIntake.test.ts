import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { AcquisitionMethod, ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { usePantryIntake } from '../usePantryIntake';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const PANTRY_ID = 'p-1';

// Args are load-bearing: the connection is keyed on them.
const STOCKED_PANTRY = gql`
  query SeedIntakePantry(
    $id: ID!
    $itemsFirst: Int
    $itemsFilter: PantryItemFilters
    $itemsOrderBy: PantryItemOrderBy
  ) {
    pantry(id: $id) {
      __typename
      id
      itemsConnection(
        first: $itemsFirst
        filters: $itemsFilter
        orderBy: $itemsOrderBy
      ) {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
          }
        }
      }
    }
  }
`;

function cacheHolding(pantryItemId: string) {
  const cache = makeCache();
  cache.writeQuery({
    query: STOCKED_PANTRY,
    variables: {
      id: PANTRY_ID,
      itemsFirst: 100,
      itemsFilter: undefined,
      itemsOrderBy: undefined,
    },
    data: {
      pantry: {
        __typename: 'Pantry',
        id: PANTRY_ID,
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'PantryItemEdge',
              cursor: pantryItemId,
              node: { __typename: 'PantryItem', id: pantryItemId },
            },
          ],
        },
      },
    },
  });
  return cache;
}

const ROW = gql`
  fragment _IntakeRowProbe on PantryItem {
    id
    item {
      id
    }
    unit {
      id
    }
    acquisitionMethod
  }
`;

const createAnswering = (pantryItemId?: string) =>
  recordMock(CreatePantryItemDocument, {
    dataFor: (vars): MockDataFor<typeof CreatePantryItemDocument> => ({
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: {
          __typename: 'PantryItem',
          id:
            pantryItemId ??
            String((vars.input as { id: string } | undefined)?.id),
        },
      },
    }),
  });

describe('usePantryIntake', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the day of the add on the input, for its default expiry', async () => {
    const create = createAnswering('pi-new');
    const { result } = renderHookWithApollo(() => usePantryIntake(PANTRY_ID), {
      operationMocks: [create.mock],
    });

    await act(async () => {
      await result.current.addItem('Milk', {
        item: { id: 'cat-milk' },
        quantity: 1,
      });
    });

    const [fired] = create.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fired?.input).toMatchObject({ today: fired?.today });
  });

  it('shows the row with what the caller knows beyond the input', async () => {
    const cache = makeCache();
    const create = createAnswering();
    const { result } = renderHookWithApollo(() => usePantryIntake(PANTRY_ID), {
      cache,
      operationMocks: [create.mock],
    });

    let row;
    await act(async () => {
      const added = result.current.addItem(
        'Oats',
        { item: { variation: 'esm-1' }, quantity: 1 },
        {
          local: {
            itemId: 'item-oats',
            unitId: 'unit-bag',
            acquisitionMethod: AcquisitionMethod.BarcodeScan,
          },
        },
      );
      // Read before the answer lands: the row is written before the create fires.
      const [published] = Object.keys(cache.extract()).filter(key =>
        key.startsWith('PantryItem:'),
      );
      row = published
        ? cache.readFragment({ id: published, fragment: ROW })
        : undefined;
      await added;
    });

    expect(row).toMatchObject({
      item: { id: 'item-oats' },
      unit: { id: 'unit-bag' },
      acquisitionMethod: AcquisitionMethod.BarcodeScan,
    });
  });

  it('drops the minted row when the server answers with the stack it holds', async () => {
    const cache = cacheHolding('pi-held');
    const create = createAnswering('pi-held');
    const { result } = renderHookWithApollo(() => usePantryIntake(PANTRY_ID), {
      cache,
      operationMocks: [create.mock],
    });

    await act(async () => {
      await result.current.addItem('Milk', {
        item: { id: 'cat-milk' },
        quantity: 1,
      });
    });

    const [fired] = create.fired;
    const minted = (fired?.input as { id: string }).id;
    const snapshot = cache.extract();
    expect(snapshot).not.toHaveProperty(`PantryItem:${minted}`);
    expect(snapshot).not.toHaveProperty(`Item:local-item-${minted}`);
    expect(JSON.stringify(snapshot[`Pantry:${PANTRY_ID}`])).not.toContain(
      minted,
    );
  });

  it('tells the user about a refusal only when asked to', async () => {
    const refusal = () =>
      recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'nope',
            field: 'quantity',
          },
        },
      });
    const quiet = renderHookWithApollo(() => usePantryIntake(PANTRY_ID), {
      operationMocks: [refusal().mock],
    });
    let outcome;
    await act(async () => {
      outcome = await quiet.result.current.addItem('Milk', {
        item: { id: 'cat-milk' },
        quantity: 1,
      });
    });
    expect(outcome).toMatchObject({ status: 'rejected' });
    expect(alertService.alert).not.toHaveBeenCalled();

    const told = renderHookWithApollo(() => usePantryIntake(PANTRY_ID), {
      operationMocks: [refusal().mock],
    });
    await act(async () => {
      await told.result.current.addItem(
        'Milk',
        { item: { id: 'cat-milk' }, quantity: 1 },
        { present: 'alert' },
      );
    });
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });
});
