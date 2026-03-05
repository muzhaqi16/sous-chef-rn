import React, { useRef } from 'react';
import { View, Pressable, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useRecyclingState } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import { SPRING } from '#constants/animations';

const ACTION_WIDTH = 80;

interface ShoppingSwipeableProps {
  children: React.ReactNode;
  itemId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onSwipeableWillOpen?: (ref: React.RefObject<{ close: () => void }>) => void;
  onSwipeableClose?: () => void;
}

export const ShoppingSwipeable: React.FC<ShoppingSwipeableProps> = ({
  children,
  itemId,
  onEdit,
  onDelete,
  onPress,
  onLongPress,
  onSwipeableWillOpen,
  onSwipeableClose,
}) => {
  const { theme } = useUnistyles();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  // Expose close() for coordinator
  const closeRef = useRef<{ close: () => void }>({
    close: () => {
      translateX.set(withSpring(0, SPRING.SNAPPY));
    },
  });

  // Synchronous reset on cell recycling — fires during render (before paint)
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(translateX);
    translateX.set(0);
  });

  // Pre-defined in RN runtime scope — scheduleOnRN requires this pattern
  const notifyWillOpen = () => {
    onSwipeableWillOpen?.(closeRef);
  };

  const notifyClose = () => {
    onSwipeableClose?.();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-5, 5])
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const raw = startX.value + e.translationX;
      // Clamp: left action (edit) revealed by swiping right → max ACTION_WIDTH
      // Right action (delete) revealed by swiping left → min -ACTION_WIDTH
      const maxRight = onEdit ? ACTION_WIDTH : 0;
      const maxLeft = onDelete ? -ACTION_WIDTH : 0;
      translateX.value = Math.max(maxLeft, Math.min(maxRight, raw));
    })
    .onEnd((e) => {
      'worklet';
      const velocity = e.velocityX;
      const x = translateX.value;

      // Determine snap position based on position + velocity
      if (x > ACTION_WIDTH * 0.4 || (x > 0 && velocity > 500)) {
        // Snap open left (edit)
        translateX.value = withSpring(ACTION_WIDTH, SPRING.SNAPPY);
        scheduleOnRN(notifyWillOpen);
      } else if (x < -ACTION_WIDTH * 0.4 || (x < 0 && velocity < -500)) {
        // Snap open right (delete)
        translateX.value = withSpring(-ACTION_WIDTH, SPRING.SNAPPY);
        scheduleOnRN(notifyWillOpen);
      } else {
        // Snap closed
        translateX.value = withSpring(0, SPRING.SNAPPY);
        scheduleOnRN(notifyClose);
      }
    });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleEditPress = () => {
    HapticService.light();
    translateX.set(withSpring(0, SPRING.SNAPPY));
    onEdit?.();
  };

  const handleDeletePress = () => {
    HapticService.light();
    translateX.set(withSpring(0, SPRING.SNAPPY));
    onDelete?.();
  };

  // Accessibility actions
  const accessibilityActions = [
    ...(onEdit ? [{ name: 'edit', label: 'Edit' }] : []),
    ...(onDelete ? [{ name: 'delete', label: 'Delete' }] : []),
  ];

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'edit': onEdit?.(); break;
      case 'delete': onDelete?.(); break;
    }
  };

  return (
    <View
      style={swipeStyles.container}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {/* Left action (edit) — behind content on left side */}
      {!!onEdit && (
        <View style={[swipeStyles.leftAction, { backgroundColor: theme.colors.charade['950'] }]}>
          <Pressable onPress={handleEditPress} style={[swipeStyles.actionButton, { borderColor: theme.colors.white }]}>
            <Icon name="create-outline" size={theme.fonts.size.xl} color={theme.colors.white} />
          </Pressable>
        </View>
      )}

      {/* Right action (delete) — behind content on right side */}
      {!!onDelete && (
        <View style={[swipeStyles.rightAction, { backgroundColor: theme.colors.charade['950'] }]}>
          <Pressable onPress={handleDeletePress} style={[swipeStyles.actionButton, { borderColor: theme.colors.white }]}>
            <Icon name="trash-outline" size={theme.fonts.size.xl} color={theme.colors.white} />
          </Pressable>
        </View>
      )}

      {/* Main content — slides to reveal actions */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[swipeStyles.content, animatedContentStyle]}>
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={150}
            accessibilityHint="Swipe left or right for more actions"
          >
            {children}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const swipeStyles = StyleSheet.create(theme => ({
  container: {
    overflow: 'visible',
  },
  leftAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: theme.radii.lg,
    borderBottomLeftRadius: theme.radii.lg,
  },
  rightAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
  },
  content: {
    overflow: 'hidden',
    borderRadius: theme.radii.lg,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
}));
