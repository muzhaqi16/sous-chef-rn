import React from 'react';

import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  expanded,
  onToggle,
  children,
}) => {
  // The header's bottom border is a separator between it and the content, so it
  // only shows while expanded — collapsed, it's just the header (no stray
  // divider over an empty body).
  styles.useVariants({ expanded });
  return (
    <>
      <AppPressable style={styles.header} onPress={onToggle}>
        <Text size="base" weight="semibold">
          {title}
          {count != null ? ` (${count})` : ''}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          tone="textSecondary"
        />
      </AppPressable>
      {!!expanded && children}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    variants: {
      expanded: {
        true: {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        false: {},
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
