import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Text } from '#components/atoms/Text';
import { hitSlop } from '#/theme/foundations/sizes';

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

interface SectionHeaderRowProps {
  title: string;
  /** A text action at the row's end, such as "See all" or "Add all". */
  action?: SectionHeaderAction;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A section's heading with an optional action for the whole section. */
export const SectionHeaderRow: React.FC<SectionHeaderRowProps> = ({
  title,
  action,
  style,
  testID,
}) => (
  <View style={[styles.row, style]} testID={testID}>
    <SectionHeader>{title}</SectionHeader>
    {action ? (
      <AppPressable
        onPress={action.onPress}
        disabled={action.disabled}
        hitSlop={hitSlop.md}
        accessibilityRole="button"
        testID={action.testID}
      >
        <Text role="label" tone="accent">
          {action.label}
        </Text>
      </AppPressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
}));
