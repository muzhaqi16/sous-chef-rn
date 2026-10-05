import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { restockVariables, usePantryRestock } from '../usePantryRestock';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const ROW_ID = 'pi-oats';

const QUANTITY = gql`
  fragment _PantryRestockProbe on PantryItem {
    id
    quantity
  }
`;

function cacheWithRow(quantity: number) {
  const cache = makeCache();
  cache.writeFragment({
    fragment: QUANTITY,
    data: { __typename: 'PantryItem', id: ROW_ID, quantity },
  });
  return cache;
}

const readQuantity = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<{ quantity: number }>({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: QUANTITY,
  })?.quantity;

describe('usePantryRestock', () => {
  it.each([
    [3, 4],
    [null, 3],
  ])(
    'with a cached count of %p, shows %p before the server answers',
    async (cachedQuantity, shown) => {
      const cache = cacheWithRow(3);
      const restock = recordMock(RestockPantryItemDocument, {
        data: {
          restockPantryItem: {
            __typename: 'RestockPantryItemPayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              pantryItem: { __typename: 'PantryItem', id: ROW_ID, quantity: 4 },
            },
          },
        },
      });
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache,
        operationMocks: [restock.mock],
      });

      let beforeAnswer;
      await act(async () => {
        const restocked = result.current.restock(ROW_ID, {
          quantity: 1,
          cachedQuantity,
          present: 'none',
        });
        beforeAnswer = readQuantity(cache);
        await restocked;
      });

      expect(beforeAnswer).toBe(shown);
      expect(restock.fired[0]?.input).toMatchObject({
        id: ROW_ID,
        amount: { measured: { quantity: 1 } },
      });
    },
  );
});

describe('restockVariables', () => {
  it('dates the restock and keys its ledger row, once per call', () => {
    const first = restockVariables({
      id: ROW_ID,
      amount: { measured: { quantity: 1 } },
    });
    const second = restockVariables({
      id: ROW_ID,
      amount: { measured: { quantity: 1 } },
    });

    expect(first.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.input).toMatchObject({ id: ROW_ID, today: first.today });
    expect(first.input.idempotencyKey).toEqual(expect.any(String));
    expect(second.input.idempotencyKey).not.toBe(first.input.idempotencyKey);
  });
});
