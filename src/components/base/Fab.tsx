import React, { useCallback } from 'react';
import {Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon, IconName, IconLibrary} from '#utils/iconUtils';
import {HapticService} from '#services/haptic/HapticService';
import {getTabBarBottomPadding} from '#constants/layout';
import {SPRING} from '#/constants/animations';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  onPress?: () => void;
  icon?: IconName;
  library?: IconLibrary;
  position?: {bottom?: number; right?: number; left?: number; top?: number};
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const FAB: React.FC<FABProps> = ({
  onPress = () => {},
  icon = 'add',
  library,
  position = {bottom: 20, right: 20},
  accessibilityLabel = 'Add',
  accessibilityHint = 'Tap to add a new item',
}) => {
  const {bottom: safeBottom} = useSafeAreaInsets();
  const {theme} = useUnistyles();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, SPRING.PRESS);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING.PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    HapticService.medium();
    onPress();
  }, [onPress]);

  // Calculate position above tab bar
  const fabPosition = React.useMemo(
    () => ({
      ...position,
      bottom: getTabBarBottomPadding(safeBottom) + (position.bottom || 4),
    }),
    [position, safeBottom],
  );

  return (
    <View style={[styles.fab, fabPosition]}>
      <AnimatedPressable
        style={[styles.fabButton, animatedStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}>
        <Icon name={icon} size={24} color={theme.colors.white} library={library} />
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    zIndex: theme.zIndex.fab,
    ...theme.shadows.lg,
  },
  fabButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.full,
  },
}));
