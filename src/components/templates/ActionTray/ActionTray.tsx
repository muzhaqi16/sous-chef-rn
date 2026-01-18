import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';
import { Backdrop } from './Backdrop';
import { ActionTrayContent } from './ActionTrayContent';
import { useActionTray } from './hooks/useActionTray';
import type { ActionTrayProps, ActionTrayRef } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ActionTray = forwardRef<ActionTrayRef, ActionTrayProps>(
  (
    {
      children,
      style,
      maxHeight = SCREEN_HEIGHT * 0.7,
      onClose,
      onOpen,
      title,
      showCloseButton = true,
      enableBackdrop = true,
      enableGestures = true,
    },
    ref,
  ) => {
    const { translateY, active, touchable, scrollTo, open, close, isActive, toggle } =
      useActionTray({
        maxHeight,
        onClose,
        onOpen,
      });

    useImperativeHandle(
      ref,
      () => ({
        open,
        close,
        isActive,
        toggle,
      }),
      [open, close, isActive, toggle],
    );

    const context = useSharedValue({ y: 0 });
    const MAX_TRANSLATE_Y = -maxHeight;

    const gesture = useMemo(
      () =>
        Gesture.Pan()
          .enabled(enableGestures)
          .onStart(() => {
            context.value = { y: translateY.value };
          })
          .onUpdate(event => {
            // Only allow swiping down when tray is open
            if (event.translationY > -50) {
              translateY.value = event.translationY + context.value.y;
            }
          })
          .onEnd(event => {
            if (event.translationY > 100) {
              // Close the tray when user swipes down enough
              close();
            } else {
              // Restore to previous position if swipe is insufficient
              scrollTo(context.value.y);
            }
          }),
      [enableGestures, translateY, context, close, scrollTo],
    );

    const trayStyle = useAnimatedStyle(() => {
      const borderRadius = interpolate(
        translateY.value,
        [MAX_TRANSLATE_Y + 50, MAX_TRANSLATE_Y],
        [25, 10],
        Extrapolation.CLAMP,
      );

      return {
        borderRadius,
        transform: [{ translateY: translateY.value }],
      };
    }, [MAX_TRANSLATE_Y]);

    // Fade based on translateY position for smooth visibility transitions
    const visibilityStyle = useAnimatedStyle(
      () => ({
        opacity: interpolate(
          translateY.value,
          [maxHeight, 0],
          [0, 1],
          Extrapolation.CLAMP,
        ),
      }),
      [maxHeight],
    );

    const handleBackdropTap = () => {
      close();
    };

    const handleClose = () => {
      close();
    };

    // Conditionally render - touchable stays true during close animation
    // to preserve smooth exit animations
    if (!touchable) {
      return null;
    }

    return (
      <>
        {enableBackdrop && (
          <Backdrop onTap={handleBackdropTap} isActive={active} />
        )}
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[styles.container, { maxHeight }, trayStyle, visibilityStyle, style]}
            pointerEvents={touchable ? 'auto' : 'none'}
          >
            <ActionTrayContent
              title={title}
              showCloseButton={showCloseButton}
              onClose={handleClose}
            >
              {children}
            </ActionTrayContent>
          </Animated.View>
        </GestureDetector>
      </>
    );
  },
);

ActionTray.displayName = 'ActionTray';

export type { ActionTrayRef, ActionTrayProps } from './types';

const styles = UnistylesStyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    width: '95%',
    position: 'absolute',
    bottom: 30,
    borderCurve: 'continuous',
    alignSelf: 'center',
    padding: theme.spacing.lg,
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
}));
