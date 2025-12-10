import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { CardRightSlotProps } from './types';

/**
 * Right slot component for BaseItemCard
 * Renders meta info, counter, drag handle, or custom content
 */
export const CardRightSlot: React.FC<CardRightSlotProps> = ({
  type,
  primary,
  secondary,
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
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginLeft: 12,
  },
  metaContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  primary: {
    fontSize: 15,
    fontWeight: theme.fonts.weight.semibold,
    color: '#374151',
  },
  secondary: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.4,
  },
  counterValue: {
    alignItems: 'center',
    minWidth: 40,
    marginHorizontal: 4,
  },
  counterText: {
    fontSize: 16,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  counterUnit: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },
}));
