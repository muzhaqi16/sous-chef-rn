import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Text } from '#components/atoms/Text';

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
    <SectionHeader style={styles.title}>{title}</SectionHeader>
    {action ? (
      <AppPressable
        onPress={action.onPress}
        disabled={action.disabled}
        style={styles.action}
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
  // The full touch target, without growing the row past its heading. It grows
  // upward: below, it keeps the 8 dp reach it always had, short of the content.
  action: {
    minWidth: theme.sizes.touchTarget.min,
    minHeight: theme.sizes.touchTarget.min,
    marginTop: -(
      theme.sizes.touchTarget.min -
      theme.type.label.lineHeight -
      theme.spacing.sm
    ),
    marginBottom: -theme.spacing.sm,
    // The label sits on the heading's line, above the reach below it.
    paddingBottom: theme.spacing.sm,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  // Wraps rather than pushing the action past the screen edge at large text.
  title: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
}));
