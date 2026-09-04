import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Insets the rule from the container's edges by the gutter. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A hairline rule. Its thickness is `theme.borderWidth.hairline`, which does
 * NOT follow the density setting — a rule that scales reads as a border.
 */
export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  inset = false,
  style,
  testID,
}) => {
  styles.useVariants({ orientation, inset });
  return (
    <View
      accessibilityRole="none"
      style={[styles.rule, style]}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  rule: {
    backgroundColor: theme.colors.divider,
    variants: {
      orientation: {
        horizontal: { height: theme.borderWidth.hairline, width: '100%' },
        vertical: { width: theme.borderWidth.hairline, alignSelf: 'stretch' },
      },
      inset: {
        true: { marginHorizontal: theme.spacing.md },
        false: {},
      },
    },
  },
}));

export default Divider;
