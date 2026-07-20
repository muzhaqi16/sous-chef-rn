import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import type { ParamListBase, NavigationProp } from '@react-navigation/native';
import {
  useStandardBottomSheet,
  type BottomSheetModalRef,
} from '../useStandardBottomSheet';
import { createFakeBottomSheetModal } from '#/test-utils/gorhomModalStateMachine';

// Track present/dismiss calls on the BottomSheetModal ref
const mockPresent = jest.fn();
const mockDismiss = jest.fn();

// The hook only invokes `present` / `dismiss` on the ref, so the test attaches
// just those methods through a ref typed to that subset.
type SheetRefMethods = Pick<BottomSheetModalRef, 'present' | 'dismiss'>;
const attachRefMocks = (
  ref: React.RefObject<BottomSheetModalRef | null>,
): void => {
  (ref as React.RefObject<SheetRefMethods | null>).current = {
    present: mockPresent,
    dismiss: mockDismiss,
  };
};

// Stateful fake BottomSheetModal lives in #/test-utils/gorhomModalStateMachine —
// it models gorhom 5.2.14's MODAL_STATUS gate (present() no-ops while DISMISSING,
// a redundant dismiss() on a closed modal wedges it) that the plain jest.fn()
// mocks above can't see. Reused across sheet tests via the reopen invariant.

// Mock the hooks this depends on
jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: () => ({ damping: 80, stiffness: 500 }),
}));

jest.mock('#hooks/useBottomSheetBackHandler', () => ({
  useBottomSheetBackHandler: jest.fn(),
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

    // onDismiss is wrapped by safeOnDismiss for backdrop cleanup;
    // verify calling it invokes the original callback
    result.current.modalProps.onDismiss?.();
    expect(onDismiss).toHaveBeenCalled();
  });

  // Invariant for the whole gorhom-5214 lifecycle bug class: after ANY close
  // path, a subsequent open must put the sheet back on screen. Each path closes
  // the sheet and drives the parent's `visible` to false the way the real
  // consumer wiring does (`onDismiss → setVisible(false)`), then reopens. The
  // stateful fake honors gorhom's DISMISSING render-gate, so a redundant
  // `dismiss()` wedges it and the reopen `present()` no-ops — which plain
  // jest.fn() mocks can't observe.
  describe.each([
    ['self-close (swipe / backdrop tap)', 'self'] as const,
    ['programmatic close (parent drops visible)', 'programmatic'] as const,
  ])('reopens after %s', (_label, kind) => {
    it('puts the sheet back on screen', () => {
      const fake = createFakeBottomSheetModal();
      const onDismiss = jest.fn();
      const { result, rerender } = renderHook(
        ({ visible }: { visible: boolean }) =>
          useStandardBottomSheet({ ...defaultOptions, visible, onDismiss }),
        { initialProps: { visible: false } },
      );
      (result.current.ref as React.RefObject<unknown>).current = fake;

      rerender({ visible: true }); // open
      expect(fake.onScreen).toBe(true);

      if (kind === 'self') {
        // gorhom closes internally (no call to our dismiss()) then fires onDismiss
        fake.selfClose();
        result.current.modalProps.onDismiss?.(); // safeOnDismiss
        expect(onDismiss).toHaveBeenCalled();
        rerender({ visible: false }); // parent reacts — must NOT redundantly dismiss
      } else {
        // parent drops visible directly → effect dismisses → onDismiss fires
        rerender({ visible: false });
        fake.selfClose();
        result.current.modalProps.onDismiss?.();
      }

      rerender({ visible: true }); // reopen
      expect(fake.onScreen).toBe(true);
    });
  });

  it('reopens after a blur-close → focus cycle with onDismiss wired to clear visible', () => {
    const fake = createFakeBottomSheetModal();
    const navListeners: Record<string, Array<() => void>> = {};
    const navigation = {
      isFocused: () => true,
      addListener: (event: string, cb: () => void) => {
        (navListeners[event] ??= []).push(cb);
        return () => {};
      },
    } as unknown as NavigationProp<ParamListBase>;

    // Real consumers wire `onDismiss` to clear their own `visible` state. If a
    // blur-triggered dismiss ran that callback, `visible` would go false and the
    // sheet could never re-present — the hook must suppress onDismiss on blur.
    let visible = false;
    const onDismiss = jest.fn(() => {
      visible = false;
    });

    const { result, rerender } = renderHook(
      ({ visible: v }: { visible: boolean }) =>
        useStandardBottomSheet({ ...defaultOptions, visible: v, onDismiss }),
      {
        initialProps: { visible },
        wrapper: ({ children }) =>
          React.createElement(
            NavigationContext.Provider,
            { value: navigation },
            children,
          ),
      },
    );
    // Attach the fake BEFORE the first present (render visible=false first).
    (result.current.ref as React.RefObject<unknown>).current = fake;

    visible = true;
    rerender({ visible }); // open on the attached fake
    expect(fake.onScreen).toBe(true);

    // Blur dismisses the sheet; gorhom then fires onDismiss once the close
    // settles (the fake doesn't auto-fire it, so drive it like the real portal).
    act(() => navListeners.blur?.forEach(cb => cb()));
    expect(fake.onScreen).toBe(false);
    act(() => result.current.modalProps.onDismiss?.());

    // The blur-close must NOT notify the consumer, so `visible` survives.
    expect(onDismiss).not.toHaveBeenCalled();
    expect(visible).toBe(true);

    // Refocus re-presents the sheet with its state intact.
    act(() => navListeners.focus?.forEach(cb => cb()));
    expect(fake.onScreen).toBe(true);
  });

  it('a focused (non-blur) dismiss still notifies the consumer', () => {
    const fake = createFakeBottomSheetModal();
    const navListeners: Record<string, Array<() => void>> = {};
    const navigation = {
      isFocused: () => true,
      addListener: (event: string, cb: () => void) => {
        (navListeners[event] ??= []).push(cb);
        return () => {};
      },
    } as unknown as NavigationProp<ParamListBase>;

    const onDismiss = jest.fn();
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useStandardBottomSheet({ ...defaultOptions, visible, onDismiss }),
      {
        initialProps: { visible: false },
        wrapper: ({ children }) =>
          React.createElement(
            NavigationContext.Provider,
            { value: navigation },
            children,
          ),
      },
    );
    (result.current.ref as React.RefObject<unknown>).current = fake;

    rerender({ visible: true });
    expect(fake.onScreen).toBe(true);

    // User closes the sheet while the screen is focused (swipe / backdrop tap):
    // gorhom self-closes then fires onDismiss. This is NOT a blur, so the
    // consumer must be notified so it can clear its own visible state.
    fake.selfClose();
    act(() => result.current.modalProps.onDismiss?.());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('an interrupted blur-close does not swallow the next real dismiss', () => {
    const fake = createFakeBottomSheetModal();
    const navListeners: Record<string, Array<() => void>> = {};
    const navigation = {
      isFocused: () => true,
      addListener: (event: string, cb: () => void) => {
        (navListeners[event] ??= []).push(cb);
        return () => {};
      },
    } as unknown as NavigationProp<ParamListBase>;

    const onDismiss = jest.fn();
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useStandardBottomSheet({ ...defaultOptions, visible, onDismiss }),
      {
        initialProps: { visible: false },
        wrapper: ({ children }) =>
          React.createElement(
            NavigationContext.Provider,
            { value: navigation },
            children,
          ),
      },
    );
    (result.current.ref as React.RefObject<unknown>).current = fake;

    rerender({ visible: true });
    expect(fake.onScreen).toBe(true);

    // Blur starts a dismiss and arms the blur-dismiss flag …
    act(() => navListeners.blur?.forEach(cb => cb()));
    expect(fake.onScreen).toBe(false);

    // … but the screen refocuses and the sheet re-presents BEFORE gorhom ever
    // fired onDismiss for that close (the close was interrupted, so its
    // onDismiss never arrives). Re-presenting must disarm the stale flag.
    act(() => navListeners.focus?.forEach(cb => cb()));
    expect(fake.onScreen).toBe(true);

    // The user now genuinely closes the sheet while focused — this dismiss
    // must reach the consumer, not be swallowed by the leftover blur flag.
    fake.selfClose();
    act(() => result.current.modalProps.onDismiss?.());
    expect(onDismiss).toHaveBeenCalledTimes(1);
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

  it('wires onAnimate into modalProps so the backdrop claims at open start', () => {
    // The slot is claimed on gorhom's onAnimate (open-animation start) rather
    // than onChange (settle), so the dim ramps in lockstep with the sheet.
    const { result } = renderHook(() => useStandardBottomSheet(defaultOptions));

    expect(typeof result.current.modalProps.onAnimate).toBe('function');
    // Callable without a provider mounted (falls back to a no-op claim).
    expect(() =>
      result.current.modalProps.onAnimate?.(-1, 0, 1000, 0),
    ).not.toThrow();
  });

  it('forwards a user-supplied onAnimate alongside the backdrop claim', () => {
    const onAnimate = jest.fn();
    const { result } = renderHook(() =>
      useStandardBottomSheet({ ...defaultOptions, onAnimate }),
    );

    result.current.modalProps.onAnimate?.(-1, 0, 1000, 0);
    expect(onAnimate).toHaveBeenCalledWith(-1, 0, 1000, 0);
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
      attachRefMocks(result.current.ref);

      rerender({ visible: true });

      expect(mockPresent).toHaveBeenCalled();
    });

    it('calls dismiss on ref when visible changes to false', () => {
      const { result, rerender } = renderHook(
        (props: { visible: boolean }) =>
          useStandardBottomSheet({ ...defaultOptions, visible: props.visible }),
        { initialProps: { visible: true } },
      );

      attachRefMocks(result.current.ref);

      rerender({ visible: false });

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('does not call present or dismiss when visible is omitted', () => {
      const { result } = renderHook(() =>
        useStandardBottomSheet(defaultOptions),
      );

      // Attach mocks to verify no calls happen
      attachRefMocks(result.current.ref);

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

    // The hook uses useContext(NavigationContext) + addListener, so tests
    // provide a mock navigation via context wrapper.
    type Listener = () => void;
    // The hook only reads `isFocused` / `addListener` off navigation, so the
    // mock implements exactly that subset of the real prop.
    type MockNavigation = Pick<
      NavigationProp<ParamListBase>,
      'isFocused' | 'addListener'
    >;
    const createMockNavigation = () => {
      const listeners: Record<string, Listener[]> = {};
      const navigation: MockNavigation = {
        isFocused: jest.fn(() => true),
        addListener: jest.fn((event: string, cb: Listener) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
          return () => {
            listeners[event] = listeners[event].filter(l => l !== cb);
          };
        }),
      } as MockNavigation;
      return {
        navigation,
        emit: (event: string) => {
          listeners[event]?.forEach(cb => cb());
        },
      };
    };

    const navWrapper =
      (nav: MockNavigation) =>
      ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          NavigationContext.Provider,
          { value: nav as NavigationProp<ParamListBase> },
          children,
        );

    it('re-presents the sheet on focus after a blur dismiss when visible is true', () => {
      const { navigation, emit } = createMockNavigation();
      const { result } = renderHook(
        () => useStandardBottomSheet({ ...defaultOptions, visible: true }),
        { wrapper: navWrapper(navigation) },
      );

      attachRefMocks(result.current.ref);

      // Blur dismisses (clears the presented flag); focus then re-presents.
      // Focus while already presented is a no-op — only a prior blur re-arms it.
      // (Focus/blur drive `isFocused` state, so flush the re-render with act.)
      act(() => emit('blur'));
      act(() => emit('focus'));

      expect(mockPresent).toHaveBeenCalled();
    });

    it('dismisses the sheet on blur when visible is true', () => {
      const { navigation, emit } = createMockNavigation();
      const { result } = renderHook(
        () => useStandardBottomSheet({ ...defaultOptions, visible: true }),
        { wrapper: navWrapper(navigation) },
      );

      attachRefMocks(result.current.ref);

      act(() => emit('blur'));

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('does not present or dismiss on focus/blur when visible is false', () => {
      const { navigation, emit } = createMockNavigation();
      const { result } = renderHook(
        () => useStandardBottomSheet({ ...defaultOptions, visible: false }),
        { wrapper: navWrapper(navigation) },
      );

      attachRefMocks(result.current.ref);

      act(() => emit('focus'));
      expect(mockPresent).not.toHaveBeenCalled();

      act(() => emit('blur'));
      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it('does not touch the sheet on focus/blur when visible is undefined (manual)', () => {
      const { navigation, emit } = createMockNavigation();
      const { result } = renderHook(
        () => useStandardBottomSheet(defaultOptions),
        { wrapper: navWrapper(navigation) },
      );

      attachRefMocks(result.current.ref);

      act(() => emit('focus'));
      act(() => emit('blur'));

      expect(mockPresent).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });
});
