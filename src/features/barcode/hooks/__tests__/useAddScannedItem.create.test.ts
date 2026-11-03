import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UnitType } from '#/graphql/generated/schemaTypes';
import type { PackageContents } from '#domain/stockAmount';
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

const oneJar = (contents: PackageContents | null = null): ScanAmount => ({
  packaged: true,
  count: 1,
  unitId: 'unit-jar',
  contents,
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

describe('what a scan states one package holds', () => {
  it('states a measure as the package size', async () => {
    const sent = await createSent(
      oneJar({ amount: 5, unitId: 'unit-lb', unitType: UnitType.Weight }),
    );

    expect(sent).toMatchObject({
      amount: {
        packages: {
          count: 1,
          unitId: 'unit-jar',
          size: { netWeight: 5, netWeightUnitId: 'unit-lb' },
        },
      },
    });
    expect(sent.measurementProfile).toBeUndefined();
  });

  it('states a count as what the package is used by', async () => {
    const sent = await createSent(
      oneJar({ amount: 10, unitId: 'unit-can', unitType: UnitType.Count }),
    );

    expect(sent).toMatchObject({
      amount: { packages: { count: 1, unitId: 'unit-jar' } },
      measurementProfile: {
        portionUnitId: 'unit-can',
        portionsPerTrackingUnit: 10,
      },
    });
  });

  it('states nothing of its own when the record sizes it', async () => {
    const sent = await createSent(oneJar());

    expect(sent).toMatchObject({
      amount: { packages: { count: 1, unitId: 'unit-jar' } },
    });
    expect(sent.measurementProfile).toBeUndefined();
    expect(sent).not.toHaveProperty('consumeUnit');
  });
});
