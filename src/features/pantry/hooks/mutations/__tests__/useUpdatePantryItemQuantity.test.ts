import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { useUpdatePantryItemQuantity } from '../useUpdatePantryItemQuantity';

jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const QUANTITY = gql`
  fragment UpdateQuantityProbe on PantryItem {
    id
    quantity
  }
`;

const STOCK = gql`
  fragment UpdateQuantityStockProbe on PantryItem {
    id
    heldQuantity
    displayAmount {
      quantity
      unit {
        id
        symbol
      }
    }
  }
`;

const UNIT = {
  __typename: 'Unit',
  id: 'unit-1',
  name: 'piece',
  symbol: 'pc',
  type: UnitType.Count,
  displayAsFraction: false,
};

it('writes and sends nothing for a quantity no parser can read', async () => {
  const cache = seedCache([
    {
      __typename: 'PantryItem',
      id: 'pi-1',
      version: 2,
      quantity: 3,
      unit: UNIT,
    },
  ]);
  const { result } = renderHookWithApollo(
    () => useUpdatePantryItemQuantity({}),
    { cache, operationMocks: [] },
  );

  await act(async () => {
    await result.current.updateQuantity({
      itemId: 'pi-1',
      quantityInput: 'abc',
      quantityValue: Number.NaN,
    });
  });

  expect(
    cache.readFragment<{ quantity: number }>({
      id: cache.identify({ __typename: 'PantryItem', id: 'pi-1' }),
      fragment: QUANTITY,
    })?.quantity,
  ).toBe(3);
  // Nothing was sent, so nothing can come back refused.
  await act(async () => {
    await Promise.resolve();
  });
  expect(alertService.alert).not.toHaveBeenCalled();
});

it('sets an amount stated in dozens as the pieces it stands for', async () => {
  const cache = seedCache([
    {
      __typename: 'PantryItem',
      id: 'pi-1',
      version: 2,
      quantity: 12,
      heldQuantity: 12,
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: 1,
        unit: { __typename: 'Unit', id: 'u-doz', symbol: 'doz' },
      },
      unit: UNIT,
    },
  ]);
  const sent = recordMock(UpdatePantryItemQuantityDocument, {
    dataFor: (): MockDataFor<typeof UpdatePantryItemQuantityDocument> => ({
      updatePantryItemQuantity: {
        __typename: 'UpdatePantryItemQuantityPayload',
        pantryItem: { __typename: 'PantryItem', id: 'pi-1', version: 3 },
      },
    }),
  });
  const { result } = renderHookWithApollo(
    () => useUpdatePantryItemQuantity({}),
    { cache, operationMocks: [sent.mock] },
  );

  const readStock = () =>
    cache.readFragment({
      id: cache.identify({ __typename: 'PantryItem', id: 'pi-1' }),
      fragment: STOCK,
    });

  let settled: Promise<boolean> | undefined;
  act(() => {
    settled = result.current.updateQuantity({
      itemId: 'pi-1',
      quantityInput: '2',
      quantityValue: 2,
      statedIn: { id: 'u-doz', symbol: 'doz', conversionFactor: 12 },
    });
  });

  // Written before the server answers: 24 pc, shown as the 2 doz typed.
  expect(readStock()).toMatchObject({
    heldQuantity: 24,
    displayAmount: { quantity: 2, unit: { id: 'u-doz', symbol: 'doz' } },
  });
  await act(async () => {
    await settled;
  });
  expect(sent.fired[0]).toMatchObject({
    input: { quantity: '2', unitId: 'u-doz' },
  });
});
