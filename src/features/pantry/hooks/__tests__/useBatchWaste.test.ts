import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemUsageDocument,
  WastePantryItemBatchDocument,
} from '#features/pantry/graphql/pantry.generated';
import { UsagePurpose, WasteReason } from '#graphql/generated/schemaTypes';
import { useBatchWaste } from '../useBatchWaste';

const batch = { id: 'batch-2', pantryItemId: 'stack-1', quantity: 3 };
const stated = (over: { quantity: number; all: boolean }) => ({
  wasteReason: WasteReason.Mold,
  isComposted: true,
  isRecycled: false,
  notes: 'fuzzy',
  usageUnitId: 'unit-piece',
  ...over,
});

// Queued answers: the write is held, which is no failure.
const wasteWhole = () =>
  recordMock(WastePantryItemBatchDocument, {
    data: { wastePantryItemBatch: null },
  });
const wastePart = () =>
  recordMock(CreatePantryItemUsageDocument, {
    data: { createPantryItemUsage: null },
  });

const render = (answers: ReturnType<typeof recordMock>[]) =>
  renderHookWithApollo(() => useBatchWaste(), {
    operationMocks: answers.map(({ mock }) => mock),
  });

describe('useBatchWaste', () => {
  it('throws the batch out whole when all it holds goes, and closes', async () => {
    const whole = wasteWhole();
    const part = wastePart();
    const { result } = render([whole, part]);
    act(() => result.current.setWastingBatchId(batch.id));

    await act(async () => {
      await result.current.confirmBatchWaste(
        batch,
        stated({ quantity: 3, all: true }),
      );
    });

    expect(part.fired).toEqual([]);
    expect(whole.fired[0]).toMatchObject({
      input: {
        batchId: 'batch-2',
        wasteReason: WasteReason.Mold,
        isComposted: true,
        isRecycled: false,
        notes: 'fuzzy',
      },
    });
    expect(result.current.wastingBatchId).toBeNull();
  });

  it('records part of the batch as a waste drawn from it', async () => {
    const whole = wasteWhole();
    const part = wastePart();
    const { result } = render([whole, part]);

    await act(async () => {
      await result.current.confirmBatchWaste(
        batch,
        stated({ quantity: 1, all: false }),
      );
    });

    expect(whole.fired).toEqual([]);
    expect(part.fired[0]).toMatchObject({
      input: {
        pantryItemId: 'stack-1',
        targetBatchId: 'batch-2',
        amount: { quantity: 1 },
        usageUnitId: 'unit-piece',
        purpose: UsagePurpose.Waste,
        wasteReason: WasteReason.Mold,
      },
    });
  });
});
