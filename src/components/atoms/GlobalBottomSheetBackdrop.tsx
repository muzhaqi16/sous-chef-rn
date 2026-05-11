import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useBackdropClaim } from '../providers/OverlayBackdropProvider';
import { Pressable } from '#components/atoms/themedComponents';

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

export const GlobalBottomSheetBackdrop: React.FC<
  GlobalBottomSheetBackdropProps
> = ({
  animatedIndex,
  disappearsOnIndex = -1,
  opacity = 0.5,
  pressBehavior = 'close',
  onClose,
}) => {
  // Track open-ness as RN state derived from the sheet's animatedIndex.
  // The backdrop claim's lifetime is tied directly to this — when the sheet
  // closes (or this component unmounts for any reason), useBackdropClaim's
  // effect cleanup releases the claim. There is no manual hideBackdrop to
  // miss.
  const [isOpen, setIsOpen] = useState(false);
  useAnimatedReaction(
    () => animatedIndex.get() > disappearsOnIndex,
    (open, prev) => {
      if (open !== prev) {
        scheduleOnRN(setIsOpen, open);
      }
    },
    [disappearsOnIndex],
  );

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handlePress =
    pressBehavior === 'none'
      ? undefined
      : () => {
          onCloseRef.current?.();
        };

  useBackdropClaim(isOpen, { opacity, onPress: handlePress });

  // Transparent placeholder — press handling lives on the GlobalBackdrop.
  return <Pressable style={styles.backdrop} pointerEvents="none" />;
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
