import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { CorrectPantryItemPackageSizeDocument } from '#features/pantry/graphql/pantry.generated';
import { useCorrectPackageSize } from '../useCorrectPackageSize';

jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

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
    id: cache.identify({ __typename: 'PantryItemBatch', id: 'b-1' }),
    fragment: BATCH,
  });

const correction = {
  pantryItemId: 'pi-1',
  batchId: 'b-1',
  netWeight: 22,
  netWeightUnitId: 'u-oz',
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

  let corrected: boolean | undefined;
  await act(async () => {
    corrected = await result.current.correctPackageSize(correction);
  });

  expect(corrected).toBe(true);
  expect(m.fired).toEqual([
    {
      input: {
        batchId: 'b-1',
        packageSize: { netWeight: 22, netWeightUnitId: 'u-oz' },
        reason: 'label misread',
        version: 4,
        // Without the key a queued replay writes the history row twice.
        idempotencyKey: expect.any(String),
      },
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
      netWeight: 624,
      netWeightUnitId: 'u-g',
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
        field: 'packageSize',
      },
    },
  });
  const { result } = renderHookWithApollo(() => useCorrectPackageSize(), {
    cache,
    operationMocks: [m.mock],
  });

  let corrected: boolean | undefined;
  await act(async () => {
    corrected = await result.current.correctPackageSize(correction);
  });

  expect(corrected).toBe(false);
  expect(readBatch(cache)).toEqual(
    expect.objectContaining({ netWeight: 32, remainingNetWeight: 16 }),
  );
  expect(alertService.alert).toHaveBeenCalledWith(
    'Error',
    t('errors.field.packageSize'),
  );
});
