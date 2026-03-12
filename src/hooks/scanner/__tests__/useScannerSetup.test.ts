import { renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useScannerSetup, type ScannerContext } from '../useScannerSetup';

type ScannerOptions = Parameters<typeof useScannerSetup>[0];

// Capture the handler passed to setScannerProps
let capturedHandler: (() => void) | undefined;
const mockSetScannerProps = jest.fn((handler?: () => void) => {
  capturedHandler = handler;
});

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({ setScannerProps: mockSetScannerProps }),
}));

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
  capturedHandler = undefined;
});

describe('useScannerSetup', () => {
  const defaultOptions: ScannerOptions = {
    homeId: 'home-1',
    context: { source: 'pantry', pantryId: 'p-1' },
  };

  it('calls setScannerProps with handler and true on mount', () => {
    renderHook(() => useScannerSetup(defaultOptions));

    expect(mockSetScannerProps).toHaveBeenCalledWith(
      expect.any(Function),
      true,
    );
  });

  it('calls setScannerProps(undefined, false) on unmount', () => {
    const { unmount } = renderHook(() => useScannerSetup(defaultOptions));

    unmount();

    expect(mockSetScannerProps).toHaveBeenLastCalledWith(undefined, false);
  });

  it('does not register scanner when enabled is false', () => {
    renderHook(() => useScannerSetup({ ...defaultOptions, enabled: false }));

    expect(mockSetScannerProps).not.toHaveBeenCalled();
  });

  it('navigates to barcode scanner with context when homeId is set', () => {
    renderHook(() => useScannerSetup(defaultOptions));

    capturedHandler?.();

    expect(mockNav.navigateTo.barcode).toHaveBeenCalledWith(
      defaultOptions.context,
    );
  });

  it('shows alert when homeId is null and no onNoHome provided', () => {
    renderHook(() =>
      useScannerSetup({
        ...defaultOptions,
        homeId: null,
      }),
    );

    capturedHandler?.();

    expect(Alert.alert).toHaveBeenCalledWith(
      'No Home Selected',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockNav.navigateTo.barcode).not.toHaveBeenCalled();
  });

  it('calls onNoHome callback when homeId is null', () => {
    const onNoHome = jest.fn();

    renderHook(() =>
      useScannerSetup({
        ...defaultOptions,
        homeId: null,
        onNoHome,
      }),
    );

    capturedHandler?.();

    expect(onNoHome).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('reads latest homeId from ref (not stale closure)', () => {
    const { rerender } = renderHook(
      (props: ScannerOptions) => useScannerSetup(props),
      { initialProps: { ...defaultOptions, homeId: null as string | null } },
    );

    // Initially homeId is null — scanner should show alert
    capturedHandler?.();
    expect(Alert.alert).toHaveBeenCalled();
    jest.clearAllMocks();

    // Update homeId — effect should NOT re-run (ref pattern), but handler should read new value
    rerender({ ...defaultOptions, homeId: 'home-2' });

    capturedHandler?.();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNav.navigateTo.barcode).toHaveBeenCalledWith(
      defaultOptions.context,
    );
  });

  it('reads latest context from ref on scan', () => {
    const context1: ScannerContext = { source: 'pantry', pantryId: 'p-1' };
    const context2: ScannerContext = { source: 'shoppingList', listId: 'l-1' };

    const { rerender } = renderHook(
      (props: ScannerOptions) => useScannerSetup(props),
      { initialProps: { homeId: 'home-1', context: context1 } },
    );

    rerender({ homeId: 'home-1', context: context2 });

    capturedHandler?.();

    expect(mockNav.navigateTo.barcode).toHaveBeenCalledWith(context2);
  });

  it('does not re-call setScannerProps when only homeId changes', () => {
    const { rerender } = renderHook(
      (props: ScannerOptions) => useScannerSetup(props),
      { initialProps: defaultOptions },
    );

    mockSetScannerProps.mockClear();

    rerender({ ...defaultOptions, homeId: 'home-2' });

    // setScannerProps should not be called again — homeId is tracked via ref
    expect(mockSetScannerProps).not.toHaveBeenCalled();
  });
});
