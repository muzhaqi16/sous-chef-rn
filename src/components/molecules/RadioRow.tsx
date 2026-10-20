import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';

interface RadioRowProps {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** The row's own spacing and surface; the mark and its content sit in a row. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}

/** One choice of several: a radio mark before its content, announced as a radio. */
export const RadioRow: React.FC<RadioRowProps> = ({
  selected,
  onPress,
  disabled = false,
  style,
  testID,
  children,
}) => (
  <AppPressable
    style={[styles.row, style]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected, disabled }}
    testID={testID}
  >
    <Icon
      name={selected ? 'radio-button-on' : 'radio-button-off'}
      size={20}
      tone={selected ? 'primary' : 'textTertiary'}
    />
    {children}
  </AppPressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
