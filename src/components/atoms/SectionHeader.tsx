import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

export interface SectionHeaderProps {
  children: React.ReactNode;
  /**
   * `title` names a section in the body's own scale; `overline` is the small
   * uppercase label that sits above one.
   */
  variant?: 'title' | 'overline';
  /** Placement only — margins and rules. The type treatment lives here. */
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * The one type treatment for a section heading. Every feature had its own
 * fontSize/weight/colour triple, so a change to the scale reached none of them.
 * Spacing and rules stay at the call site, which is what actually differs.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  children,
  variant = 'title',
  style,
  testID,
}) => {
  styles.useVariants({ variant });
  return (
    <Text
      role={variant === 'overline' ? 'label' : 'heading'}
      tone={variant === 'overline' ? 'secondary' : 'primary'}
      style={[styles.header, style]}
      testID={testID}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    variants: {
      variant: {
        title: {},
        overline: {
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.wide,
        },
      },
    },
  },
}));
