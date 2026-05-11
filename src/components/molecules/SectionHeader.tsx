import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

export type SectionHeaderVariant = 'warning' | 'default' | 'info' | 'success';

export interface SectionHeaderProps {
  /** Emoji or icon to display */
  icon?: string;
  /** Section title (will be uppercased) */
  title: string;
  /** Item count to display */
  count?: number;
  /** Visual variant affecting text color */
  variant?: SectionHeaderVariant;
  /** Optional action button label */
  actionLabel?: string;
  /** Callback when action button is pressed */
  onActionPress?: () => void;
  /** Test ID for accessibility */
  testID?: string;
}

/**
 * Generic section header component for list sections
 *
 * @example
 * <SectionHeader
 *   icon="⏰"
 *   title="EXPIRING SOON"
 *   count={5}
 *   variant="warning"
 *   actionLabel="Sort ↕"
 *   onActionPress={handleSort}
 * />
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  count,
  variant = 'default',
  actionLabel,
  onActionPress,
  testID,
}) => {
  styles.useVariants({
    variant: variant === 'default' ? undefined : variant,
  });

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.leftContent}>
        {icon ? <Text size="sm">{icon}</Text> : null}
        <Text weight="semibold" style={styles.title}>
          {title}
          {count !== undefined ? ` (${count})` : ''}
        </Text>
      </View>

      {!!actionLabel && !!onActionPress && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text weight="semibold" style={styles.actionLabel}>
            {actionLabel}
          </Text>
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.sm - 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.colors.sectionHeader.defaultText,
    variants: {
      variant: {
        warning: { color: theme.colors.sectionHeader.warningText },
        info: { color: theme.colors.info },
        success: { color: theme.colors.success },
      },
    },
  },
  actionLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.sectionHeader.actionText,
  },
}));
