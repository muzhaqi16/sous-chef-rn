import { useRef, useEffect, useContext } from 'react';
import { Keyboard } from 'react-native';
import {
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUnistyles } from 'react-native-unistyles';
import { NavigationContext } from '@react-navigation/native';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { useBottomSheetBackdropClaim } from '#hooks/useBottomSheetBackdropClaim';

/**
 * Theme-reactive `BottomSheetModal` — applies `backgroundStyle` and
 * `handleIndicatorStyle` defaults from the theme via `withUnistyles`. Re-exported
 * as `BottomSheetModal` so callers swap their import source from
 * `@gorhom/bottom-sheet` to `#hooks/useStandardBottomSheet` without other code
 * changes. The wrap means theme updates flow through the C++ ShadowTree —
 * callers don't need to re-render to see the new colors.
 */
const ThemedBottomSheetModal = withUnistyles(GorhomBottomSheetModal, theme => ({
  backgroundStyle: { backgroundColor: theme.colors.surface },
  handleIndicatorStyle: { backgroundColor: theme.colors.textSecondary },
}));

export { ThemedBottomSheetModal as BottomSheetModal };

/**
 * Type re-export for `useRef<BottomSheetModal>(null)` callsites — points at the
 * underlying gorhom class, since the wrapped component's value type isn't a
 * usable type position. The `unknown` type argument matches the ref type the
 * wrapped component expects (gorhom 5.2.14 defaults the `present(data)` payload
 * generic to `never`, which a bare `BottomSheetModal` ref no longer satisfies).
 */
export type BottomSheetModalRef = GorhomBottomSheetModal<unknown>;

export interface UseStandardBottomSheetOptions {
  /** When provided, auto-manages present/dismiss. Omit to manage presentation manually via ref. */
  visible?: boolean;
  onDismiss: () => void;
  snapPoints: (string | number)[];
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  enableDynamicSizing?: boolean;
  /**
   * When truthy:
   * - Appends an expanded snap point (if not already present)
   * - Defaults keyboardBehavior to 'interactive'
   * - Snaps back to index 0 when keyboard hides
   *
   * Pass `true` to use the default '95%' expanded point,
   * or a string (e.g. `'85%'`) to specify a custom expanded snap point.
   */
  keyboardAware?: boolean | string;
  /** Optional user-supplied onChange — wrapped so the hook can drive the
   *  global backdrop slot off gorhom's authoritative index transitions. */
  onChange?: (index: number, position: number, type: number) => void;
  /** Optional user-supplied onAnimate — wrapped so the hook can claim the
   *  global backdrop at the START of the open animation (gorhom fires this
   *  before onChange). */
  onAnimate?: (
    fromIndex: number,
    toIndex: number,
    fromPosition: number,
    toPosition: number,
  ) => void;
}

// Gorhom expects the snap-point type literal even though we don't branch on it.
type SnapPointType = Parameters<
  NonNullable<BottomSheetModalProps['onChange']>
>[2];

// `backdropComponent` is intentionally omitted from `modalProps` below. The
// dim overlay is painted by `GlobalBackdrop` (rendered once at App level
// inside the `BottomSheetModalProvider`), and its lifetime is driven by a
// claim/release from this hook: the slot is claimed on gorhom's `onAnimate`
// (open-animation start, so the lockstep opacity ramp drives a registered
// slot for the whole open) and released on `onChange(-1)` (settled-closed).
// That decouples the backdrop's slot from the contributor component's
// mount/unmount inside gorhom's portal, which was the source of stuck-overlay
// races after sheet dismiss and on the AddToPantrySheet → BarcodeStack round
// trip. Gorhom renders nothing when `backdropComponent` is undefined
// (BottomSheet.tsx:1784).

/**
 * Consolidates BottomSheetModal boilerplate shared across all modals:
 * ref, insets, animation configs, back handler, present/dismiss effect, and common props.
 *
 * The global dim layer is claimed imperatively against `OverlayBackdropProvider`:
 * claimed on gorhom's `onAnimate` when the target index is ≥0 (open-animation
 * start) and released on `onChange(-1)` (settled-closed). Claiming at the start
 * is what keeps the dim in lockstep with the sheet on the way in. A defensive
 * release runs on hook unmount in case the sheet is torn down by its parent's
 * conditional render before reaching index -1 (gorhom's portal can in that
 * case skip firing `onClose`, so we never rely on it).
 *
 * Usage (auto-managed presentation):
 * ```
 * const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
 *   visible, onDismiss: onClose, snapPoints: ['60%'],
 * });
 * ```
 *
 * Usage (manual presentation — for modals that check extra conditions):
 * ```
 * const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
 *   onDismiss: onClose, snapPoints: ['60%'],
 * });
 * useEffect(() => {
 *   if (visible && item) ref.current?.present();
 *   else ref.current?.dismiss();
 * }, [visible, item]);
 * ```
 */
export function useStandardBottomSheet({
  visible,
  onDismiss,
  snapPoints,
  keyboardBehavior,
  enableDynamicSizing = false,
  keyboardAware = false,
  onChange: userOnChange,
  onAnimate: userOnAnimate,
}: UseStandardBottomSheetOptions) {
  const insets = useSafeAreaInsets();
  const ref = useRef<GorhomBottomSheetModal<unknown>>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(ref, visible ?? false);

  // Backdrop integration. The hook creates an `animatedIndex` SharedValue
  // we pass to gorhom (gorhom drives it as the sheet animates), derives an
  // opacity SV from it via `interpolate`, and claims the global backdrop
  // with that SV — meaning the dim layer ramps in/out in lockstep with
  // the sheet on the UI thread, zero JS-thread delay. The slot is claimed
  // from `onAnimate` (open-animation start) so the lockstep ramp drives a
  // registered slot for the whole open; release stays on `onChange(-1)`.
  const {
    animatedIndex,
    onChange: handleBackdrop,
    onAnimate: handleBackdropAnimate,
  } = useBottomSheetBackdropClaim(ref);

  // Compute final snap points: append expanded point when keyboardAware and not already present
  const expandedPoint =
    typeof keyboardAware === 'string' ? keyboardAware : '95%';
  const finalSnapPoints =
    keyboardAware && snapPoints[snapPoints.length - 1] !== expandedPoint
      ? [...snapPoints, expandedPoint]
      : snapPoints;

  // 'interactive' fits the vast majority of input-bearing sheets; callers
  // can still pass 'extend' or 'fillParent' explicitly when needed.
  const resolvedKeyboardBehavior = keyboardBehavior ?? 'interactive';

  // Track the latest visible value for the focus-aware callback below
  // without rebuilding the callback each render.
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  });

  // Auto present/dismiss when visible is provided.
  //
  // `hasPresentedRef` guards against dismissing a sheet that was never
  // presented. In @gorhom/bottom-sheet 5.2.14, calling `dismiss()` on a modal
  // still in its INITIAL status flips it to DISMISSING — and `handlePortalRender`
  // then skips rendering any DISMISSING modal, so every later `present()`
  // silently no-ops. Always-mounted sheets (rendered with `visible={false}` at
  // start) would otherwise be permanently stuck closed. Mount-on-open sheets
  // dodged it only because they never hit the initial dismiss.
  const hasPresentedRef = useRef(false);
  useEffect(() => {
    if (visible === undefined) return;
    if (visible) {
      hasPresentedRef.current = true;
      ref.current?.present();
    } else if (hasPresentedRef.current) {
      ref.current?.dismiss();
    }
  }, [visible]);

  // Navigation focus awareness — dismiss the sheet when the owning screen
  // blurs and re-present it on refocus.
  //
  // This is REQUIRED because `BottomSheetModal` renders into the
  // `BottomSheetModalProvider`'s portal at App root, ABOVE the navigation
  // container. Without this hook, an open sheet stays visually on top of
  // any newly-pushed screen (e.g. BarcodeScannerScreen pushed from a Scan
  // button inside the sheet) — the sheet would obscure the new screen
  // instead of getting out of its way.
  //
  // The imperative claim/release model makes this safe: `dismiss()` fires
  // `onChange(-1)` which releases the backdrop slot cleanly, and a subsequent
  // `present()` on refocus fires `onAnimate(toIndex=0)` which claims a fresh
  // slot at the start of the re-open animation (so the dim is present for the
  // whole re-entry).
  //
  // Short-circuits for manual-presentation callers (visible === undefined)
  // — they own the full lifecycle.
  //
  // No-ops when rendered inside a BottomSheet portal (no NavigationContext).
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!navigation) return;
    if (visibleRef.current === undefined) return;

    if (navigation.isFocused() && visibleRef.current) {
      ref.current?.present();
    }

    const unsubFocus = navigation.addListener('focus', () => {
      if (visibleRef.current) ref.current?.present();
    });
    const unsubBlur = navigation.addListener('blur', () => {
      if (visibleRef.current) ref.current?.dismiss();
    });

    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  // Compose the backdrop claim with the caller's onChange. The current
  // user-supplied onChange is held in a ref so its identity changing across
  // renders doesn't churn `handleChange` (and force gorhom to rewire). The
  // React Compiler auto-memoizes `handleChange` based on its stable-ref
  // closure (no try-catch in this hook).
  const userOnChangeRef = useRef(userOnChange);
  useEffect(() => {
    userOnChangeRef.current = userOnChange;
  });

  const handleChange = (
    index: number,
    position: number,
    type: SnapPointType,
  ): void => {
    handleBackdrop(index);
    userOnChangeRef.current?.(index, position, type);
  };

  // Same composition pattern for onAnimate — held in a ref so a changing
  // user callback identity doesn't churn `handleAnimate`. This is what fires
  // the backdrop claim at the open-animation start (see useBottomSheetBackdropClaim).
  const userOnAnimateRef = useRef(userOnAnimate);
  useEffect(() => {
    userOnAnimateRef.current = userOnAnimate;
  });

  const handleAnimate = (
    fromIndex: number,
    toIndex: number,
    fromPosition: number,
    toPosition: number,
  ): void => {
    handleBackdropAnimate(fromIndex, toIndex);
    userOnAnimateRef.current?.(fromIndex, toIndex, fromPosition, toPosition);
  };

  // Snap back to initial position when keyboard hides (keyboardAware only)
  useEffect(() => {
    if (!keyboardAware) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      ref.current?.snapToIndex(0);
    });
    return () => sub.remove();
  }, [keyboardAware]);

  // Gorhom fires `onClose` and `onChange(-1)` from separate animated
  // reactions. If `onClose` wins the race it calls `unmount()` — tearing
  // down the portal before `onChange(-1)` reaches JS — so our
  // `handleBackdrop(-1)` never runs and the backdrop claim leaks.
  // Defensive release here guarantees the claim is freed; calling
  // `handleBackdrop(-1)` when the claim is already released is a no-op.
  const safeOnDismiss = () => {
    handleBackdrop(-1);
    onDismiss();
  };

  // All standard BottomSheetModal props as a spread-ready object.
  // Theme-derived `backgroundStyle` / `handleIndicatorStyle` come from the
  // wrapped `BottomSheetModal` re-exported above — no theme reads here.
  const modalProps: Partial<BottomSheetModalProps> = {
    snapPoints: finalSnapPoints,
    enablePanDownToClose: true,
    enableDynamicSizing,
    topInset: insets.top,
    onDismiss: safeOnDismiss,
    onChange: handleChange,
    onAnimate: handleAnimate,
    animatedIndex,
    animationConfigs,
    keyboardBehavior: resolvedKeyboardBehavior,
    keyboardBlurBehavior: 'restore',
    android_keyboardInputMode: 'adjustPan',
  };

  // Standard content container padding
  const contentContainerStyle = { paddingBottom: insets.bottom + 16 };

  // Imperative helpers — prefer these over `ref.current?.dismiss()` etc.
  // For state-driven control, pass the `visible` option above and let the
  // hook handle present/dismiss for you. These helpers are for cases where
  // an event handler (e.g. an onPress) needs to imperatively close the sheet.
  const present = () => ref.current?.present();
  const dismiss = () => ref.current?.dismiss();
  const close = () => ref.current?.close();
  const snapToIndex = (index: number) => ref.current?.snapToIndex(index);

  return {
    ref,
    modalProps,
    contentContainerStyle,
    insets,
    present,
    dismiss,
    close,
    snapToIndex,
  };
}
