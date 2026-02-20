import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import React from 'react';

interface UseStandardBottomSheetOptions {
  /** When provided, auto-manages present/dismiss. Omit to manage presentation manually via ref. */
  visible?: boolean;
  onDismiss: () => void;
  snapPoints: (string | number)[];
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  enableDynamicSizing?: boolean;
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
  keyboardBehavior = 'extend',
  enableDynamicSizing = false,
}: UseStandardBottomSheetOptions) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(ref, visible ?? false);

  // Auto present/dismiss when visible is provided
  useEffect(() => {
    if (visible === undefined) return;
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  // Backdrop component that dismisses via ref
  const backdropComponent = useCallback(
    (props: any) =>
      React.createElement(GlobalBottomSheetBackdrop, {
        ...props,
        disappearsOnIndex: -1,
        appearsOnIndex: 0,
        pressBehavior: 'close',
        onClose: () => ref.current?.dismiss(),
      }),
    [],
  );

  // All standard BottomSheetModal props as a spread-ready object
  const modalProps = useMemo(
    () => ({
      snapPoints,
      enablePanDownToClose: true,
      enableDynamicSizing,
      topInset: insets.top,
      onDismiss,
      animationConfigs,
      backgroundStyle: { backgroundColor: theme.colors.background },
      handleIndicatorStyle: { backgroundColor: theme.colors.textSecondary },
      keyboardBehavior,
      keyboardBlurBehavior: 'restore' as const,
      android_keyboardInputMode: 'adjustResize' as const,
      backdropComponent,
    }),
    [
      snapPoints,
      enableDynamicSizing,
      insets.top,
      onDismiss,
      animationConfigs,
      theme.colors.background,
      theme.colors.textSecondary,
      keyboardBehavior,
      backdropComponent,
    ],
  );

  // Standard content container padding
  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: insets.bottom + 16 }),
    [insets.bottom],
  );

  return { ref, modalProps, contentContainerStyle, theme, insets };
}
