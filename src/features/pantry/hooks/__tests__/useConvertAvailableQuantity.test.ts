import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { ConvertQuantityDocument } from '#operations/item/conversions.generated';
import { useConvertAvailableQuantity } from '../useConvertAvailableQuantity';

const options = {
  pantryItemId: 'rice',
  selectedUnitId: 'oz',
  trackingUnitId: 'lb',
  availableInTrackingUnit: 2,
  conversionRatio: null,
};

it('converts on the initial render and re-evaluates when stock changes', async () => {
  const log = operationLog();
  const answer = recordMock(ConvertQuantityDocument, {
    dataFor: variables => ({
      convertQuantity: { value: Number(variables.quantity) * 16 },
    }),
  });
  const { result, rerender } = renderHookWithApollo(
    props => useConvertAvailableQuantity(props),
    { initialProps: options, links: [log.link], operationMocks: [answer.mock] },
  );
  await act(async () => {
    await log.answered(ConvertQuantityDocument);
  });
  expect(result.current.availableInSelectedUnit).toBe(32);
  rerender({ ...options, availableInTrackingUnit: 1 });
  await act(async () => {
    await log.answered(ConvertQuantityDocument, 2);
  });
  expect(result.current.availableInSelectedUnit).toBe(16);
});
it('distinguishes a refused conversion from a missing network answer', async () => {
  const log = operationLog();
  const answer = recordMock(ConvertQuantityDocument, {
    data: { convertQuantity: null },
  });
  const { result } = renderHookWithApollo(
    () => useConvertAvailableQuantity(options),
    { links: [log.link], operationMocks: [answer.mock] },
  );
  await act(async () => {
    await log.answered(ConvertQuantityDocument);
  });
  expect(result.current).toMatchObject({
    availableInSelectedUnit: null,
    conversionUnavailable: true,
  });
});
it('uses actual contents for the matching unit without converting package counts', () => {
  const { result } = renderHookWithApollo(() =>
    useConvertAvailableQuantity({
      ...options,
      selectedUnitId: 'fl-oz',
      trackingUnitId: 'carton',
      availableInTrackingUnit: 1,
      remainingNetWeight: 56,
      netWeightUnitId: 'fl-oz',
    }),
  );
  expect(result.current).toEqual({
    availableInSelectedUnit: 56,
    availableLoading: false,
    conversionUnavailable: false,
  });
});
