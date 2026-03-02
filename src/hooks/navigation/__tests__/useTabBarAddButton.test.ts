import { renderHook } from '@testing-library/react-native';
import { useTabBarAddButton } from '../useTabBarAddButton';

const mockSetAddProps = jest.fn();

// Track the focus effect callback and its cleanup
let focusEffectCallback: (() => (() => void) | void) | null = null;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    focusEffectCallback = cb;
  },
}));

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({
    setAddProps: mockSetAddProps,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  focusEffectCallback = null;
});

describe('useTabBarAddButton', () => {
  it('registers the handler on focus via useFocusEffect', () => {
    const handler = jest.fn();
    renderHook(() => useTabBarAddButton(handler));

    // Simulate focus
    expect(focusEffectCallback).not.toBeNull();
    const cleanup = focusEffectCallback!();

    // setAddProps should be called with the stable wrapper, disabled=false, tooltip=undefined
    expect(mockSetAddProps).toHaveBeenCalledWith(
      expect.any(Function),
      false,
      undefined,
    );

    // Cleanup should unregister
    if (typeof cleanup === 'function') {
      cleanup();
    }
    // After cleanup, setAddProps should be called with undefined
    expect(mockSetAddProps).toHaveBeenCalledWith(undefined);
  });

  it('unregisters on blur (cleanup function)', () => {
    const handler = jest.fn();
    renderHook(() => useTabBarAddButton(handler));

    const cleanup = focusEffectCallback!();
    mockSetAddProps.mockClear();

    if (typeof cleanup === 'function') {
      cleanup();
    }

    expect(mockSetAddProps).toHaveBeenCalledWith(undefined);
  });

  it('sets undefined when handler is undefined on focus', () => {
    renderHook(() => useTabBarAddButton(undefined));

    const cleanup = focusEffectCallback!();

    // When handler is undefined, setAddProps(undefined) should be called
    expect(mockSetAddProps).toHaveBeenCalledWith(undefined);

    if (typeof cleanup === 'function') {
      cleanup();
    }
  });

  it('passes disabled and disabledTooltip to setAddProps', () => {
    const handler = jest.fn();
    renderHook(() => useTabBarAddButton(handler, true, 'No permission'));

    focusEffectCallback!();

    expect(mockSetAddProps).toHaveBeenCalledWith(
      expect.any(Function),
      true,
      'No permission',
    );
  });

  it('the stable handler calls the latest handler ref', () => {
    const handler1 = jest.fn();
    renderHook(() => useTabBarAddButton(handler1));

    focusEffectCallback!();

    // Get the stable handler that was passed to setAddProps
    const stableHandler = mockSetAddProps.mock.calls.find(
      (call: any[]) => call[0] !== undefined && typeof call[0] === 'function',
    )?.[0];

    expect(stableHandler).toBeDefined();

    // Calling the stable handler should invoke handler1
    stableHandler();
    expect(handler1).toHaveBeenCalledTimes(1);
  });
});
