import React from 'react';
import { Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';

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
  const { theme } = useUnistyles();

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={onToggle}
      >
        <Text style={styles.title}>
          {title}
          {count != null ? ` (${count})` : ''}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
