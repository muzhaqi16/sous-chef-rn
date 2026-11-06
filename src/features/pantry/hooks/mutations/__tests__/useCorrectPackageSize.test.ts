import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { ErrorCode, UnitType } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import {
  CorrectPantryItemPackageSizeDocument,
  UpdatePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { useCorrectPackageSize } from '../useCorrectPackageSize';

jest.mock('#/services/errorService');

beforeEach(() => {
  jest.clearAllMocks();
});

const BATCH = gql`
  fragment TestBatchSize on PantryItemBatch {
    netWeight
    remainingNetWeight
  }
`;

// Only what a screen that offers the correction has cached: nothing the
// response alone carries.
function seed() {
  return seedCache([
    {
      __typename: 'PantryItem',
      id: 'pi-1',
      version: 4,
      portionUnitId: null,
      netWeightUnit: { __typename: 'Unit', id: 'u-oz' },
    },
    {
      __typename: 'PantryItemBatch',
      id: 'b-1',
      netWeight: 32,
      remainingNetWeight: 16,
    },
  ]);
}

const readBatch = (cache: ReturnType<typeof seed>) =>
  cache.readFragment<{ netWeight: number; remainingNetWeight: number }>({
    optimistic: true,
    id: cache.identify({ __typename: 'PantryItemBatch', id: 'b-1' }),
    fragment: BATCH,
  });

const correction = {
  pantryItemId: 'pi-1',
  batchId: 'b-1',
  amount: 22,
  unitId: 'u-oz',
  unitType: UnitType.Weight,
  reason: 'label misread',
};

it('sends the batch, its size, the stack version and an idempotency key', async () => {
  const m = recordMock(CorrectPantryItemPackageSizeDocument, {
    data: {
      correctPantryItemPackageSize: {
        __typename: 'CorrectPantryItemPackageSizePayload',
      },
    },
  });
  const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
    cache: seed(),
    operationMocks: [m.mock],
  });

  let refused: string | null | undefined;
  await act(async () => {
    refused = await result.current.correctPackageSize(correction);
  });

  expect(refused).toBeNull();
  expect(m.fired).toEqual([
    {
      input: {
        batchId: 'b-1',
        correction: { packageSize: { netWeight: 22, netWeightUnitId: 'u-oz' } },
        reason: 'label misread',
        version: 4,
        // Without the key a queued replay writes the history row twice.
        idempotencyKey: expect.any(String),
      },
      today: expect.any(String),
    },
  ]);
});

it('keeps the same fraction of the package: 16 of 32 oz becomes 11 of 22', async () => {
  const cache = seed();
  const m = recordMock(CorrectPantryItemPackageSizeDocument, {
    data: { correctPantryItemPackageSize: null },
  });
  const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
    cache,
    operationMocks: [m.mock],
  });

  await act(async () => {
    await result.current.correctPackageSize(correction);
  });

  expect(readBatch(cache)).toEqual(
    expect.objectContaining({ netWeight: 22, remainingNetWeight: 11 }),
  );
});

it('waits for the server when the size is stated in another unit', async () => {
  const cache = seed();
  const m = recordMock(CorrectPantryItemPackageSizeDocument, {
    data: { correctPantryItemPackageSize: null },
  });
  const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
    cache,
    operationMocks: [m.mock],
  });

  await act(async () => {
    await result.current.correctPackageSize({
      ...correction,
      amount: 624,
      unitId: 'u-g',
    });
  });

  // The batch records its size in oz; only the server converts grams.
  expect(readBatch(cache)).toEqual(
    expect.objectContaining({ netWeight: 32, remainingNetWeight: 16 }),
  );
});

it('restores the batch and says why when the correction is refused', async () => {
  const cache = seed();
  const m = recordMock(CorrectPantryItemPackageSizeDocument, {
    data: {
      correctPantryItemPackageSize: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'raw server words',
        field: 'correction.packageSize',
      },
    },
  });
  const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
    cache,
    operationMocks: [m.mock],
  });

  let refused: string | null | undefined;
  await act(async () => {
    refused = await result.current.correctPackageSize(correction);
  });

  expect(refused).toBe(t('errors.field.packageSize'));
  expect(readBatch(cache)).toEqual(
    expect.objectContaining({ netWeight: 32, remainingNetWeight: 16 }),
  );
  expect(alertService.alert).not.toHaveBeenCalled();
});

describe('a count of what a package holds', () => {
  const tenCans = {
    ...correction,
    amount: 10,
    unitId: 'u-can',
    unitType: UnitType.Count,
  };

  it('defines what the stack is used by, and leaves its size alone', async () => {
    const cache = seed();
    const update = recordMock(UpdatePantryItemDocument, {
      data: { updatePantryItem: null },
    });
    const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
      cache,
      operationMocks: [update.mock],
    });

    await act(async () => {
      await result.current.correctPackageSize(tenCans);
    });

    expect(update.fired).toEqual([
      {
        input: {
          id: 'pi-1',
          version: 4,
          idempotencyKey: expect.any(String),
          measurementProfile: {
            portionUnitId: 'u-can',
            portionsPerTrackingUnit: 10,
          },
        },
        today: expect.any(String),
        batchesFirst: 100,
      },
    ]);
    expect(readBatch(cache)).toEqual(
      expect.objectContaining({ netWeight: 32, remainingNetWeight: 16 }),
    );
  });

  it('corrects the batch when the stack is already used by that unit', async () => {
    const cache = seed();
    seedFragment(cache, {
      fragment: gql`
        fragment TestPortion on PantryItem {
          id
          portionUnitId
        }
      `,
      data: { __typename: 'PantryItem', id: 'pi-1', portionUnitId: 'u-can' },
    });
    const correct = recordMock(CorrectPantryItemPackageSizeDocument, {
      data: { correctPantryItemPackageSize: null },
    });
    const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
      cache,
      operationMocks: [correct.mock],
    });

    await act(async () => {
      await result.current.correctPackageSize(tenCans);
    });

    expect(correct.fired[0]).toMatchObject({
      input: {
        batchId: 'b-1',
        correction: { portionsPerTrackingUnit: 10 },
      },
    });
  });

  it('says why when the stack refuses it', async () => {
    const update = recordMock(UpdatePantryItemDocument, {
      data: {
        updatePantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'raw server words',
          field: 'measurementProfile',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
      cache: seed(),
      operationMocks: [update.mock],
    });

    let refused: string | null | undefined;
    await act(async () => {
      refused = await result.current.correctPackageSize(tenCans);
    });

    expect(refused).toEqual(expect.any(String));
    expect(refused).not.toContain('raw server words');
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});
