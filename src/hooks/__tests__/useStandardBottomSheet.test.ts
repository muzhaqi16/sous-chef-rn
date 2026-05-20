import { renderHook } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStandardBottomSheet } from '../useStandardBottomSheet';

// Track present/dismiss calls on the BottomSheetModal ref
const mockPresent = jest.fn();
const mockDismiss = jest.fn();

// Mock the hooks this depends on
jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: () => ({ damping: 80, stiffness: 500 }),
}));

jest.mock('#hooks/useBottomSheetBackHandler', () => ({
  useBottomSheetBackHandler: jest.fn(),
}));

const mockedUseFocusEffect = useFocusEffect as jest.MockedFunction<
  typeof useFocusEffect
>;

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
});

describe('useStandardBottomSheet', () => {
  const defaultOptions = {
    onDismiss: jest.fn(),
    snapPoints: ['50%'],
  };

  it('returns ref, modalProps, contentContainerStyle, insets, and imperative helpers', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.ref).toBeDefined();
    expect(result.current.modalProps).toBeDefined();
    expect(result.current.contentContainerStyle).toBeDefined();
    expect(result.current.insets).toBeDefined();
    expect(typeof result.current.present).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.close).toBe('function');
    expect(typeof result.current.snapToIndex).toBe('function');
  });

  it('includes snap points in modalProps', () => {
    const { result } = renderHook(() =>
      useStandardBottomSheet({ ...defaultOptions, snapPoints: ['60%', '90%'] }),
    );

    expect(result.current.modalProps.snapPoints).toEqual(['60%', '90%']);
  });

  it('sets enablePanDownToClose to true', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.enablePanDownToClose).toBe(true);
  });

  it('defaults keyboardBehavior to interactive', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.keyboardBehavior).toBe('interactive');
  });

  it('allows overriding keyboardBehavior', () => {
    const { result } = renderHook(() =>
      useStandardBottomSheet({
        ...defaultOptions,
        keyboardBehavior: 'fillParent',
      }),
    );

    expect(result.current.modalProps.keyboardBehavior).toBe('fillParent');
  });

  it('defaults enableDynamicSizing to false', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.enableDynamicSizing).toBe(false);
  });

  it('passes onDismiss through to modalProps', () => {
    const onDismiss = jest.fn();
    const { result } = renderHook(() =>
      useStandardBottomSheet({ ...defaultOptions, onDismiss }),
    );

    expect(result.current.modalProps.onDismiss).toBe(onDismiss);
  });

  it('includes animation configs in modalProps', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.animationConfigs).toEqual({
      damping: 80,
      stiffness: 500,
    });
  });

  // Theme-derived background/handle indicator styles are now applied by the
  // exported `withUnistyles`-wrapped `BottomSheetModal` (not by modalProps),
  // so they don't appear in the hook's return value anymore.

  it('includes paddingBottom in contentContainerStyle from insets', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    // paddingBottom = insets.bottom + 16
    expect(
      result.current.contentContainerStyle.paddingBottom,
    ).toBeGreaterThanOrEqual(16);
  });

  it('omits backdropComponent (global dim layer drives itself)', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    // The dim overlay is painted by `GlobalBackdrop` (rendered once at App
    // level) and driven by a claim from this hook keyed off gorhom's
    // `onChange(index)`. With `backdropComponent` omitted, gorhom renders
    // nothing for the per-sheet backdrop (BottomSheet.tsx:1784).
    expect(result.current.modalProps.backdropComponent).toBeUndefined();
  });

  describe('auto present/dismiss', () => {
    it('calls present on ref when visible changes to true', () => {
      const { result, rerender } = renderHook(
        (props: { visible: boolean }) =>
          useStandardBottomSheet({ ...defaultOptions, visible: props.visible }),
        { initialProps: { visible: false } },
      );

      // Attach mock methods to the ref
      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      rerender({ visible: true });

      expect(mockPresent).toHaveBeenCalled();
    });

    it('calls dismiss on ref when visible changes to false', () => {
      const { result, rerender } = renderHook(
        (props: { visible: boolean }) =>
          useStandardBottomSheet({ ...defaultOptions, visible: props.visible }),
        { initialProps: { visible: true } },
      );

      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      rerender({ visible: false });

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('does not call present or dismiss when visible is omitted', () => {
      const { result } = renderHook(() =>
        useStandardBottomSheet(defaultOptions),
      );

      // Attach mocks to verify no calls happen
      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      // visible is not provided, so effect should not call present/dismiss
      expect(mockPresent).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });

  describe('navigation focus lifecycle', () => {
    // The sheet dismisses on screen blur and re-presents on focus, so it
    // gets out of the way when a sibling screen is pushed (e.g.
    // BarcodeScannerScreen pushed from a Scan button inside the sheet).
    // `BottomSheetModal` renders into the BottomSheetModalProvider portal
    // ABOVE the navigation container, so without this hook the sheet
    // would stay visually on top of any new screen.

    // Helper: capture the useFocusEffect callback so the test can drive blur.
    const installFocusCapture = () => {
      let captured: (() => void | (() => void)) | null = null;
      mockedUseFocusEffect.mockImplementation(cb => {
        captured = cb as () => void | (() => void);
      });
      return {
        focus: () => captured?.(),
        blur: () => {
          const cleanup = captured?.() as (() => void) | undefined;
          cleanup?.();
        },
        getCleanup: () => captured?.() as (() => void) | undefined,
      };
    };

    afterEach(() => {
      // Restore the default mock (`cb => cb()`) for other test blocks.
      mockedUseFocusEffect.mockImplementation(cb => cb() as any);
    });

    it('re-presents the sheet on focus when visible is true', () => {
      const fx = installFocusCapture();
      const { result } = renderHook(() =>
        useStandardBottomSheet({ ...defaultOptions, visible: true }),
      );

      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      fx.focus();

      expect(mockPresent).toHaveBeenCalled();
    });

    it('dismisses the sheet on blur when visible is true', () => {
      const fx = installFocusCapture();
      const { result } = renderHook(() =>
        useStandardBottomSheet({ ...defaultOptions, visible: true }),
      );

      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      fx.blur();

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('does not present or dismiss on focus/blur when visible is false', () => {
      const fx = installFocusCapture();
      const { result } = renderHook(() =>
        useStandardBottomSheet({ ...defaultOptions, visible: false }),
      );

      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      fx.focus();
      expect(mockPresent).not.toHaveBeenCalled();

      const cleanup = fx.getCleanup();
      cleanup?.();
      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it('does not touch the sheet on focus/blur when visible is undefined (manual)', () => {
      const fx = installFocusCapture();
      const { result } = renderHook(() =>
        useStandardBottomSheet(defaultOptions),
      );

      (result.current.ref as any).current = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      fx.focus();
      const cleanup = fx.getCleanup();
      cleanup?.();

      expect(mockPresent).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });
});
