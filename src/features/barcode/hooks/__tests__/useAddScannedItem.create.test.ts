import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import type { ScanAmount, ScannedItem } from '../../types';
import { useAddScannedItem } from '../useAddScannedItem';

const HONEY: ScannedItem = {
  id: 'item-honey',
  conceptIds: [],
  name: 'Honey',
  upc: '0002',
  canEdit: false,
  canSuggest: true,
};

const oneJar = (consumeUnitId: string | null): ScanAmount => ({
  packaged: true,
  count: 1,
  unitId: 'unit-jar',
  size: null,
  consumeUnitId,
});

const createSent = async (amount: ScanAmount) => {
  const create = recordMock(CreatePantryItemDocument, {
    data: { createPantryItem: null },
  });
  const { result } = renderHookWithApollo(
    () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
    { operationMocks: [create.mock] },
  );
  await act(async () => {
    await result.current.addToPantry(HONEY, amount);
  });
  return (create.fired[0] as { input: Record<string, unknown> }).input;
};

describe('a scan that creates a stack', () => {
  it('sets the unit the household uses it in', async () => {
    expect(await createSent(oneJar('unit-tbsp'))).toMatchObject({
      consumeUnit: { id: 'unit-tbsp' },
    });
  });

  it('names none when none was picked', async () => {
    expect(await createSent(oneJar(null))).not.toHaveProperty('consumeUnit');
  });
});
