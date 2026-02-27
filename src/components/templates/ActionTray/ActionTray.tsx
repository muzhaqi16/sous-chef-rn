import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
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
      enableBackdrop = true },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const isOpenRef = useRef(false);
    const { height } = useWindowDimensions();
    const { showBackdrop, hideBackdrop } = useOverlayBackdrop();

    // Handle sheet state changes for open/close tracking
    const handleSheetChanges = (index: number) => {
        if (index >= 0) {
          isOpenRef.current = true;
          onOpen?.();
        } else {
          // Safety net: ensure backdrop is hidden when sheet fully closes
          if (isOpenRef.current && enableBackdrop) {
            hideBackdrop();
          }
          isOpenRef.current = false;
          onClose?.();
        }
      };

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (isOpenRef.current) {
          hideBackdrop();
        }
      };
    }, [hideBackdrop]);

    // Expose same API as before
    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          if (isOpenRef.current) return;
          if (enableBackdrop) {
            showBackdrop({ opacity: 0.5, onPress: () => {
              if (isOpenRef.current && enableBackdrop) {
                hideBackdrop();
                isOpenRef.current = false;
              }
              bottomSheetRef.current?.dismiss();
            }});
          }
          bottomSheetRef.current?.present();
        },
        close: () => {
          if (isOpenRef.current && enableBackdrop) {
            hideBackdrop();
            isOpenRef.current = false;
          }
          bottomSheetRef.current?.dismiss();
        },
        toggle: () => {
          if (isOpenRef.current) {
            if (enableBackdrop) {
              hideBackdrop();
              isOpenRef.current = false;
            }
            bottomSheetRef.current?.dismiss();
          } else {
            if (enableBackdrop) {
              showBackdrop({ opacity: 0.5, onPress: () => {
                if (isOpenRef.current && enableBackdrop) {
                  hideBackdrop();
                  isOpenRef.current = false;
                }
                bottomSheetRef.current?.dismiss();
              }});
            }
            bottomSheetRef.current?.present();
          }
        },
        isActive: () => isOpenRef.current }),
      [enableBackdrop, showBackdrop, hideBackdrop],
    );

    const handleClose = () => {
      if (isOpenRef.current && enableBackdrop) {
        hideBackdrop();
        isOpenRef.current = false;
      }
      bottomSheetRef.current?.dismiss();
    };

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
            height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8 }
      : {
          elevation: 0 }) },
  background: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16 },
  handle: {
    display: 'none', // Hide default handle, ActionTrayContent has its own UI
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg } }));
