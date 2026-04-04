import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useWindowDimensions } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';
import { ActionTrayContent } from './ActionTrayContent';
import { useOverlayBackdrop } from '#components/providers/OverlayBackdropProvider';
import type { ActionTrayProps, ActionTrayRef } from './types';

// Null backdrop component - we use GlobalBackdrop instead
const NullBackdrop = () => null;

export const ActionTray = forwardRef<ActionTrayRef, ActionTrayProps>(
  (
    {
      children,
      style,
      onClose,
      onOpen,
      title,
      headerRight,
      showCloseButton = true,
      enableBackdrop = true,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [mounted, setMounted] = useState(false);
    const { height } = useWindowDimensions();
    const { showBackdrop, hideBackdrop } = useOverlayBackdrop();

    // Present the sheet once mounted, hide backdrop on unmount
    useEffect(() => {
      if (mounted) {
        bottomSheetRef.current?.present();
      }
      return () => {
        if (mounted && enableBackdrop) {
          hideBackdrop();
        }
      };
    }, [mounted, enableBackdrop, hideBackdrop]);

    const handleSheetChanges = (index: number) => {
      if (index < 0) {
        // Sheet fully closed — unmount and notify
        setMounted(false);
        onClose?.();
      }
    };

    useImperativeHandle(
      ref,
      () => {
        const dismiss = () => {
          if (enableBackdrop) {
            hideBackdrop();
          }
          bottomSheetRef.current?.dismiss();
        };
        return {
          open: () => {
            if (mounted) return;
            if (enableBackdrop) {
              showBackdrop({ opacity: 0.5, onPress: dismiss });
            }
            onOpen?.();
            setMounted(true);
          },
          close: dismiss,
          toggle: () => {
            if (mounted) {
              dismiss();
            } else {
              if (enableBackdrop) {
                showBackdrop({ opacity: 0.5, onPress: dismiss });
              }
              onOpen?.();
              setMounted(true);
            }
          },
          isActive: () => mounted,
        };
      },
      [mounted, enableBackdrop, showBackdrop, hideBackdrop, onOpen],
    );

    const handleDismiss = () => {
      if (enableBackdrop) {
        hideBackdrop();
      }
      bottomSheetRef.current?.dismiss();
    };

    if (!mounted) return null;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        detached={true}
        bottomInset={30}
        enableDynamicSizing={true}
        maxDynamicContentSize={height * 0.7}
        enablePanDownToClose={true}
        backdropComponent={NullBackdrop}
        onChange={handleSheetChanges}
        style={[styles.modal, style]}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <ActionTrayContent
            title={title}
            headerRight={headerRight}
            showCloseButton={showCloseButton}
            onClose={handleDismiss}
          >
            {children}
          </ActionTrayContent>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ActionTray.displayName = 'ActionTray';

const styles = UnistylesStyleSheet.create(theme => ({
  modal: {
    marginHorizontal: '2.5%', // Creates 95% width centered
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: -2,
        blurRadius: 8,
        spreadDistance: 0,
        color: `${theme.colors.textPrimary}1A`,
      },
    ],
  },
  background: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
  },
  handle: {
    display: 'none', // Hide default handle, ActionTrayContent has its own UI
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
}));
