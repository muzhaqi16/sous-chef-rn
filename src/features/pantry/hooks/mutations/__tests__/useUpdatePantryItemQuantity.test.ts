import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { UnitType } from '#/graphql/generated/schemaTypes';
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
