import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface PantrySectionHeaderProps {
  icon: string;
  title: string;
  count: number;
  variant?: 'warning' | 'default';
  actionLabel?: string;
  onActionPress?: () => void;
}

export const PantrySectionHeader: React.FC<PantrySectionHeaderProps> = ({
  icon,
  title,
  count,
  variant = 'default',
  actionLabel,
  onActionPress,
}) => {
  const { theme } = useUnistyles();

  const titleColor =
    variant === 'warning'
      ? theme.colors.sectionHeader.warningText
      : theme.colors.sectionHeader.defaultText;

  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color: titleColor }]}>
          {title} ({count})
        </Text>
      </View>

      {actionLabel && onActionPress && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: theme.fonts.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.sectionHeader.actionText,
  },
}));
