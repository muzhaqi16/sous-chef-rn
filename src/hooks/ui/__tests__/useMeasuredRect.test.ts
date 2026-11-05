import { renderHook } from '@testing-library/react-native';
import type { View } from 'react-native';
import { useMeasuredRect } from '../useMeasuredRect';

type MeasureCallback = Parameters<View['measure']>[0];

// A view at page (10, 30) measuring width x height.
const viewMeasuring = (width: number, height: number) =>
  ({
    measure: (callback: MeasureCallback) =>
      callback(0, 0, width, height, 10, 30),
  } as unknown as View);

beforeEach(() => {
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMeasuredRect', () => {
  it('reports the view’s page rect', () => {
    const onMeasure = jest.fn();
    const { result } = renderHook(() => useMeasuredRect(onMeasure));
    result.current.ref.current = viewMeasuring(40, 20);

    result.current.measure();

    expect(onMeasure).toHaveBeenCalledWith({
      x: 10,
      y: 30,
      width: 40,
      height: 20,
    });
  });

  // A spotlight cut to a zero-size hole points at nothing.
  it('reports nothing for a view not laid out yet', () => {
    const onMeasure = jest.fn();
    const { result } = renderHook(() => useMeasuredRect(onMeasure));
    result.current.ref.current = viewMeasuring(0, 20);

    result.current.measure();

    expect(onMeasure).not.toHaveBeenCalled();
  });

  // The tutorial's Purchased-tab step: the receiver is passed only once the
  // step starts, after the tab's last layout, so no `onLayout` measures it.
  it('measures when a receiver arrives after mount', () => {
    const onMeasure = jest.fn();
    const { result, rerender } = renderHook(
      ({ receiver }: { receiver?: typeof onMeasure }) =>
        useMeasuredRect(receiver),
      { initialProps: {} },
    );
    result.current.ref.current = viewMeasuring(40, 20);

    rerender({ receiver: onMeasure });

    expect(onMeasure).toHaveBeenCalledWith({
      x: 10,
      y: 30,
      width: 40,
      height: 20,
    });
  });

  it('leaves a receiver present from mount to its layout', () => {
    const measure = jest.fn();
    const { result, rerender } = renderHook(() => useMeasuredRect(jest.fn()));
    result.current.ref.current = { measure } as unknown as View;

    rerender({});

    expect(measure).not.toHaveBeenCalled();
  });

  it('measures nothing without a receiver', () => {
    const measure = jest.fn();
    const { result } = renderHook(() => useMeasuredRect(undefined));
    result.current.ref.current = { measure } as unknown as View;

    result.current.measure();

    expect(measure).not.toHaveBeenCalled();
  });
});
