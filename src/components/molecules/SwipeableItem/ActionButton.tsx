import React, { useMemo, useCallback } from 'react';
import { Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from '#utils/iconUtils';
import { styles } from './styles';
import { useUnistyles } from 'react-native-unistyles';
import { ActionButtonProps } from './types';

export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  icon,
  backgroundColor,
  label,
  circular = false,
  library,
  testID,
}) => {
  const { theme } = useUnistyles();

  const buttonStyle = circular
    ? styles.circularActionButton
    : styles.actionButton;
  const iconColor = theme.colors.white;
  const iconSize = theme.fonts.size['3xl'];

  // PERFORMANCE: Memoize the press handler to prevent gesture recreation
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  // PERFORMANCE: Memoize Gesture.Tap() to avoid recreating gesture on every render
  // This is critical as gesture creation involves setting up native gesture handlers
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .onEnd(() => {
          'worklet';
          scheduleOnRN(handlePress);
        })
        .shouldCancelWhenOutside(false),
    [handlePress],
  );

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[buttonStyle, { backgroundColor: backgroundColor }]}
        testID={testID}
      >
        <Icon name={icon} size={iconSize} color={iconColor} library={library} />
        {label && <Text style={styles.deleteText}>{label}</Text>}
      </Animated.View>
    </GestureDetector>
  );
};
