import { renderHook } from '@testing-library/react-native';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { useMarkFullyDrawn } from '../useMarkFullyDrawn';

jest.mock('#/services/performance/NativePerformanceService', () => ({
  NativePerformanceService: { markFullyDrawn: jest.fn() },
}));

const markFullyDrawn = jest.mocked(NativePerformanceService.markFullyDrawn);

beforeEach(() => {
  markFullyDrawn.mockClear();
});

it('marks nothing while Today shows a spinner', () => {
  renderHook(() => useMarkFullyDrawn(false));

  expect(markFullyDrawn).not.toHaveBeenCalled();
});

it('marks the launch drawn once Today shows its content', () => {
  const { rerender } = renderHook(
    ({ drawn }: { drawn: boolean }) => useMarkFullyDrawn(drawn),
    { initialProps: { drawn: false } },
  );

  rerender({ drawn: true });
  rerender({ drawn: true });

  expect(markFullyDrawn).toHaveBeenCalledTimes(1);
});
