import React, { forwardRef, useImperativeHandle, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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
      showCloseButton = true,
      enableBackdrop = true,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const isOpenRef = useRef(false);
    const { showBackdrop, hideBackdrop } = useOverlayBackdrop();

    // Handle sheet state changes for GlobalBackdrop integration
    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index >= 0) {
          isOpenRef.current = true;
          if (enableBackdrop) {
            showBackdrop({ opacity: 0.5, onPress: () => bottomSheetRef.current?.dismiss() });
          }
          onOpen?.();
        } else {
          isOpenRef.current = false;
          hideBackdrop();
          onClose?.();
        }
      },
      [enableBackdrop, showBackdrop, hideBackdrop, onOpen, onClose],
    );

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        hideBackdrop();
      };
    }, [hideBackdrop]);

    // Expose same API as before
    useImperativeHandle(
      ref,
      () => ({
        open: () => bottomSheetRef.current?.present(),
        close: () => bottomSheetRef.current?.dismiss(),
        toggle: () => {
          if (isOpenRef.current) {
            bottomSheetRef.current?.dismiss();
          } else {
            bottomSheetRef.current?.present();
          }
        },
        isActive: () => isOpenRef.current,
      }),
      [],
    );

    const handleClose = useCallback(() => {
      bottomSheetRef.current?.dismiss();
    }, []);

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        detached={true}
        bottomInset={30}
        enableDynamicSizing={true}
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
            showCloseButton={showCloseButton}
            onClose={handleClose}
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
    // Apply shadows only on iOS to prevent visual artifacts in Android edge-to-edge mode
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: theme.colors.textPrimary,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        }
      : {
          elevation: 0,
        }),
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
