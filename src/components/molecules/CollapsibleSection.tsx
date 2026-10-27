import React from 'react';

import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { CurrentThemeScope } from '#components/atoms/CurrentThemeScope';
import { ExpandChevron } from '#components/atoms/ExpandChevron';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Pads the header in from the edges, for a host with no gutter (a flush card). */
  inset?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  expanded,
  onToggle,
  children,
  inset = false,
}) => {
  // The header's bottom border is a separator between it and the content, so it
  // only shows while expanded — collapsed, it's just the header (no stray
  // divider over an empty body).
  styles.useVariants({ expanded, inset });
  return (
    <>
      <AppPressable style={styles.header} onPress={onToggle}>
        <Text role="bodyStrong">
          {title}
          {count != null ? ` (${count})` : ''}
        </Text>
        <ExpandChevron expanded={expanded} />
      </AppPressable>
      {!!expanded && <CurrentThemeScope>{children}</CurrentThemeScope>}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    variants: {
      expanded: {
        true: {
          borderBottomWidth: theme.borderWidth.hairline,
          borderBottomColor: theme.colors.border,
        },
        false: {},
      },
      inset: {
        true: { paddingHorizontal: theme.spacing.lg },
        false: {},
      },
    },
  },
}));
