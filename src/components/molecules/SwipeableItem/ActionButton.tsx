import React from 'react';
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
}) => {
  const { theme } = useUnistyles();

  const buttonStyle = circular
    ? styles.circularActionButton
    : styles.actionButton;
  const iconColor = circular ? theme.colors.white : theme.colors.white;
  const iconSize = theme.fonts.size['3xl'];

  const handlePress = () => {
    console.log('ActionButton pressed! Icon:', icon, 'Library:', library);
    onPress();
  };

  // Create tap gesture with proper priority to avoid conflicts with swipeable
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      scheduleOnRN(handlePress);
    })
    .shouldCancelWhenOutside(false);

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[buttonStyle, { backgroundColor: backgroundColor }]}
      >
        <Icon name={icon} size={iconSize} color={iconColor} library={library} />
        {label && <Text style={styles.deleteText}>{label}</Text>}
      </Animated.View>
    </GestureDetector>
  );
};
