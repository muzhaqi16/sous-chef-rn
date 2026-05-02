import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from './IconButton';

export interface BackButtonProps {
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color,
  style,
  disabled,
  testID,
}) => (
  <IconButton
    name="arrow-back"
    onPress={onPress}
    accessibilityLabel="Go back"
    color={color}
    style={style}
    disabled={disabled}
    testID={testID}
  />
);

export default BackButton;
