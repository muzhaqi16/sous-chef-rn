import { useRef, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import {
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUnistyles } from 'react-native-unistyles';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { DismissBackdrop } from '#components/atoms/DismissBackdrop';

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
 * usable type position.
 */
export type BottomSheetModalRef = GorhomBottomSheetModal;

interface UseStandardBottomSheetOptions {
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
  /**
   * When true (default), dismiss the sheet when the owning screen loses
   * navigation focus and re-present it on refocus (if `visible` is still
   * truthy). This keeps the global backdrop's ref-count clean when a sheet
   * stays "open" across a navigation push — without this, the underlying
   * BottomSheetModal can be torn down by the navigator while its tracker
   * in OverlayBackdropProvider still holds a count, leaving the backdrop
   * painted over the next screen. Pass `false` for sheets that are
   * intentionally rendered across multiple focus scopes.
   */
  dismissOnBlur?: boolean;
}

/**
 * Consolidates BottomSheetModal boilerplate shared across all modals:
 * ref, insets, animation configs, back handler, present/dismiss effect, and common props.
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
  dismissOnBlur = true,
}: UseStandardBottomSheetOptions) {
  const insets = useSafeAreaInsets();
  const ref = useRef<GorhomBottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(ref, visible ?? false);

  // Track the latest values for the focus-aware callback below without
  // rebuilding the callback each render.
  const visibleRef = useRef(visible);
  const dismissOnBlurRef = useRef(dismissOnBlur);
  useEffect(() => {
    visibleRef.current = visible;
    dismissOnBlurRef.current = dismissOnBlur;
  });

  // Compute final snap points: append expanded point when keyboardAware and not already present
  const expandedPoint =
    typeof keyboardAware === 'string' ? keyboardAware : '95%';
  const finalSnapPoints =
    keyboardAware && snapPoints[snapPoints.length - 1] !== expandedPoint
      ? [...snapPoints, expandedPoint]
      : snapPoints;

  // Resolve keyboard behavior: keyboardAware defaults to 'interactive'
  const resolvedKeyboardBehavior =
    keyboardBehavior ?? (keyboardAware ? 'interactive' : 'extend');

  // Auto present/dismiss when visible is provided
  useEffect(() => {
    if (visible === undefined) return;
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  // Navigation focus awareness — dismiss the sheet when the owning screen
  // blurs and re-present it on refocus. This keeps OverlayBackdropProvider's
  // ref-count clean when a sheet stays mounted across a navigation push
  // (e.g. AddToPantrySheet → BarcodeStack → back). The caller's `visible`
  // state is preserved, so the sheet's inner form state survives the round
  // trip. Short-circuits for manual-presentation callers (visible === undefined)
  // — they own the full lifecycle — and for callers that explicitly opt out
  // via dismissOnBlur: false.
  const [onScreenFocus] = useState(() => () => {
    if (!dismissOnBlurRef.current || visibleRef.current === undefined) {
      return undefined;
    }
    if (visibleRef.current) {
      ref.current?.present();
    }
    return () => {
      // Only dismiss if the sheet is meant to be open — avoids a redundant
      // dismiss() on an already-closed sheet.
      if (!dismissOnBlurRef.current || !visibleRef.current) return;
      ref.current?.dismiss();
    };
  });
  useFocusEffect(onScreenFocus);

  // Snap back to initial position when keyboard hides (keyboardAware only)
  useEffect(() => {
    if (!keyboardAware) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      ref.current?.snapToIndex(0);
    });
    return () => sub.remove();
  }, [keyboardAware]);

  // All standard BottomSheetModal props as a spread-ready object.
  // Theme-derived `backgroundStyle` / `handleIndicatorStyle` come from the
  // wrapped `BottomSheetModal` re-exported above — no theme reads here.
  const modalProps: Partial<BottomSheetModalProps> = {
    snapPoints: finalSnapPoints,
    enablePanDownToClose: true,
    enableDynamicSizing,
    topInset: insets.top,
    onDismiss,
    animationConfigs,
    keyboardBehavior: resolvedKeyboardBehavior,
    keyboardBlurBehavior: 'restore',
    android_keyboardInputMode: 'adjustPan',
    backdropComponent: DismissBackdrop,
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
