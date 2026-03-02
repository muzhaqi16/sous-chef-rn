import { renderHook } from '@testing-library/react-native';
import { useDeferredRender } from '../useDeferredRender';

describe('useDeferredRender', () => {
  it('returns a boolean', () => {
    const { result } = renderHook(() => useDeferredRender());

    expect(typeof result.current).toBe('boolean');
  });

  it('returns true since useDeferredValue resolves synchronously in tests', () => {
    const { result } = renderHook(() => useDeferredRender());

    expect(result.current).toBe(true);
  });

  it('ignores the delay parameter and still returns true', () => {
    const { result } = renderHook(() => useDeferredRender(5000));

    expect(result.current).toBe(true);
  });
});
