import { renderHook } from '@testing-library/react-native';
import { useOpening } from '../useOpening';

describe('useOpening', () => {
  it('opens anew each time it turns visible, and keeps the opening while hidden', () => {
    const { result, rerender } = renderHook(
      ({ visible, payload }: { visible: boolean; payload: string }) =>
        useOpening(visible, payload),
      { initialProps: { visible: false, payload: 'link' } },
    );
    expect(result.current).toBeNull();

    rerender({ visible: true, payload: 'link' });
    expect(result.current).toEqual({ id: 1, payload: 'link' });

    // Closing keeps what the sheet shows while it animates out.
    rerender({ visible: false, payload: 'text' });
    expect(result.current).toEqual({ id: 1, payload: 'link' });

    rerender({ visible: true, payload: 'text' });
    expect(result.current).toEqual({ id: 2, payload: 'text' });
  });
});
