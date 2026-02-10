import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { CardRightSlotProps } from './types';

/**
 * Right slot component for BaseItemCard
 * Renders meta info, counter, drag handle, or custom content
 */
export const CardRightSlot: React.FC<CardRightSlotProps> = ({
  type,
  primary,
  secondary,
  tertiary,
  quantity,
  unit,
  onIncrement,
  onDecrement,
  disabled = false,
  onDrag,
  children,
}) => {
  const { theme } = useUnistyles();

  if (type === 'custom' && children) {
    return <View style={styles.container}>{children}</View>;
  }

  if (type === 'dragHandle' && onDrag) {
    return (
      <Pressable onLongPress={onDrag} style={styles.dragHandle}>
        <Icon name="drag-indicator" size={24} color={theme.colors.textTertiary} />
      </Pressable>
    );
  }

  if (type === 'counter') {
    return (
      <View style={styles.counterContainer}>
        <Pressable
          onPress={onDecrement}
          disabled={disabled || quantity === 0}
          style={[
            styles.counterButton,
            (disabled || quantity === 0) && styles.counterButtonDisabled,
          ]}
        >
          <Icon
            name="remove"
            size={18}
            color={disabled || quantity === 0 ? theme.colors.textTertiary : theme.colors.primary}
          />
        </Pressable>
        <View style={styles.counterValue}>
          <Text style={styles.counterText}>{quantity || 0}</Text>
          {unit && <Text style={styles.counterUnit}>{unit}</Text>}
        </View>
        <Pressable
          onPress={onIncrement}
          disabled={disabled}
          style={[styles.counterButton, disabled && styles.counterButtonDisabled]}
        >
          <Icon
            name="add"
            size={18}
            color={disabled ? theme.colors.textTertiary : theme.colors.primary}
          />
        </Pressable>
      </View>
    );
  }

  // Default to meta
  return (
    <View style={styles.metaContainer}>
      {primary && <Text style={styles.primary}>{primary}</Text>}
      {secondary && <Text style={styles.secondary}>{secondary}</Text>}
      {tertiary && <Text style={styles.secondary}>{tertiary}</Text>}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginLeft: theme.spacing['3'],
  },
  metaContainer: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing['3'],
  },
  primary: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  secondary: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textTertiary,
    textTransform: 'capitalize',
    marginTop: theme.spacing.xs,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  counterButton: {
    width: theme.sizes.button.sm,
    height: theme.sizes.button.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.4,
  },
  counterValue: {
    alignItems: 'center',
    minWidth: theme.sizes.button.md,
    marginHorizontal: theme.spacing.xs,
  },
  counterText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  counterUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.textSecondary,
  },
  dragHandle: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
}));
