import React, { useEffect, useCallback, useRef } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useOverlayBackdrop } from '../providers/OverlayBackdropProvider';

interface GlobalBottomSheetBackdropProps extends BottomSheetBackdropProps {
  /** Index at which backdrop appears (default: 0) */
  appearsOnIndex?: number;
  /** Index at which backdrop disappears (default: -1) */
  disappearsOnIndex?: number;
  /** Backdrop opacity (default: 0.5) */
  opacity?: number;
  /** Behavior when pressing backdrop: 'close', 'collapse', or 'none' */
  pressBehavior?: 'close' | 'collapse' | 'none';
  /** Custom close handler - REQUIRED for proper dismiss behavior */
  onClose?: () => void;
}

export const GlobalBottomSheetBackdrop: React.FC<GlobalBottomSheetBackdropProps> = ({
  animatedIndex,
  appearsOnIndex: _appearsOnIndex = 0,
  disappearsOnIndex = -1,
  opacity = 0.5,
  pressBehavior = 'close',
  onClose,
}) => {
  const { showBackdrop, hideBackdrop } = useOverlayBackdrop();

  // Store onClose in a ref to avoid stale closures in worklet callbacks
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handlePress = useCallback(() => {
    if (pressBehavior === 'none') return;
    onCloseRef.current?.();
  }, [pressBehavior]);

  const handleShow = useCallback(() => {
    showBackdrop({ opacity, onPress: pressBehavior !== 'none' ? handlePress : undefined });
  }, [showBackdrop, opacity, pressBehavior, handlePress]);

  const handleHide = useCallback(() => {
    hideBackdrop();
  }, [hideBackdrop]);

  // React to animated index changes to show/hide global backdrop
  useAnimatedReaction(
    () => animatedIndex.value,
    (currentIndex, previousIndex) => {
      // Show backdrop when index rises above disappearsOnIndex
      if (currentIndex > disappearsOnIndex && (previousIndex === null || previousIndex <= disappearsOnIndex)) {
        scheduleOnRN(handleShow);
      }
      // Hide backdrop when index falls to or below disappearsOnIndex
      else if (currentIndex <= disappearsOnIndex && previousIndex !== null && previousIndex > disappearsOnIndex) {
        scheduleOnRN(handleHide);
      }
    },
    [disappearsOnIndex, handleShow, handleHide],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hideBackdrop();
    };
  }, [hideBackdrop]);

  // Return transparent view - press handling is done by global backdrop
  // This allows the sheet to still receive gestures for swipe-to-close
  return (
    <Pressable
      style={styles.backdrop}
      pointerEvents="none"
    />
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
