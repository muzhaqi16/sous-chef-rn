import { useRef, useEffect } from 'react';
import { Keyboard } from 'react-native';
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
  /**
   * When true:
   * - Appends '95%' snap point (if not already present)
   * - Defaults keyboardBehavior to 'interactive'
   * - Snaps back to index 0 when keyboard hides
   */
  keyboardAware?: boolean;
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
  keyboardAware = false }: UseStandardBottomSheetOptions) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(ref, visible ?? false);

  // Compute final snap points: append '95%' when keyboardAware and not already present
  const finalSnapPoints = keyboardAware && snapPoints[snapPoints.length - 1] !== '95%'
    ? [...snapPoints, '95%']
    : snapPoints;

  // Resolve keyboard behavior: keyboardAware defaults to 'interactive'
  const resolvedKeyboardBehavior = keyboardBehavior ?? (keyboardAware ? 'interactive' : 'extend');

  // Auto present/dismiss when visible is provided
  useEffect(() => {
    if (visible === undefined) return;
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  // Snap back to initial position when keyboard hides (keyboardAware only)
  useEffect(() => {
    if (!keyboardAware) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      ref.current?.snapToIndex(0);
    });
    return () => sub.remove();
  }, [keyboardAware]);

  // Backdrop component that dismisses via ref
  const backdropComponent = (props: any) =>
      React.createElement(GlobalBottomSheetBackdrop, {
        ...props,
        disappearsOnIndex: -1,
        appearsOnIndex: 0,
        pressBehavior: 'close',
        onClose: () => ref.current?.dismiss() });

  // All standard BottomSheetModal props as a spread-ready object
  const modalProps = ({
      snapPoints: finalSnapPoints,
      enablePanDownToClose: true,
      enableDynamicSizing,
      topInset: insets.top,
      onDismiss,
      animationConfigs,
      backgroundStyle: { backgroundColor: theme.colors.background },
      handleIndicatorStyle: { backgroundColor: theme.colors.textSecondary },
      keyboardBehavior: resolvedKeyboardBehavior,
      keyboardBlurBehavior: 'restore' as const,
      android_keyboardInputMode: 'adjustPan' as const,
      backdropComponent });

  // Standard content container padding
  const contentContainerStyle = ({ paddingBottom: insets.bottom + 16 });

  return { ref, modalProps, contentContainerStyle, theme, insets };
}
