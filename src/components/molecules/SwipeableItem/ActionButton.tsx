import React, { useCallback, useMemo } from 'react';
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
  const iconColor = circular ? theme.colors.white : theme.colors.white;
  const iconSize = theme.fonts.size['3xl'];

  // PERFORMANCE: Memoize to avoid recreating on every render
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  // PERFORMANCE: Memoize gesture to avoid recreation on every render
  // Gesture handlers are expensive to create
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
