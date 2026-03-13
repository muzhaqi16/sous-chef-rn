import { renderHook } from '@testing-library/react-native';
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

jest.mock('#components/atoms/DismissBackdrop', () => ({
  DismissBackdrop: 'DismissBackdrop',
}));

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
});

describe('useStandardBottomSheet', () => {
  const defaultOptions = {
    onDismiss: jest.fn(),
    snapPoints: ['50%'],
  };

  it('returns ref, modalProps, contentContainerStyle, theme, and insets', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.ref).toBeDefined();
    expect(result.current.modalProps).toBeDefined();
    expect(result.current.contentContainerStyle).toBeDefined();
    expect(result.current.theme).toBeDefined();
    expect(result.current.insets).toBeDefined();
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

  it('defaults keyboardBehavior to extend', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.keyboardBehavior).toBe('extend');
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

  it('applies theme colors to background and handle indicator styles', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.backgroundStyle).toEqual({
      backgroundColor: expect.any(String),
    });
    expect(result.current.modalProps.handleIndicatorStyle).toEqual({
      backgroundColor: expect.any(String),
    });
  });

  it('includes paddingBottom in contentContainerStyle from insets', () => {
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    // paddingBottom = insets.bottom + 16
    expect(
      result.current.contentContainerStyle.paddingBottom,
    ).toBeGreaterThanOrEqual(16);
  });

  it('uses DismissBackdrop as backdropComponent', () => {
    const { DismissBackdrop } = require('#components/atoms/DismissBackdrop');
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(result.current.modalProps.backdropComponent).toBe(DismissBackdrop);
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
});
