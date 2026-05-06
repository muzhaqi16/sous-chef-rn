import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { CardRightSlotProps } from './types';
import { Text } from '#components/atoms/Text';

/**
 * Lightweight meta slot — no useUnistyles, all colors from stylesheet
 */
const MetaSlot: React.FC<
  Pick<CardRightSlotProps, 'primary' | 'secondary' | 'tertiary'>
> = ({ primary, secondary, tertiary }) => (
  <View style={styles.metaContainer}>
    {primary ? (
      <Text size="base" weight="semibold">
        {primary}
      </Text>
    ) : null}
    {secondary ? (
      <Text size="xs" tone="tertiary" style={styles.secondary}>
        {secondary}
      </Text>
    ) : null}
    {tertiary ? (
      <Text size="xs" tone="tertiary" style={styles.secondary}>
        {tertiary}
      </Text>
    ) : null}
  </View>
);

/**
 * Interactive slot — needs useUnistyles for Icon colors
 */
const InteractiveSlot: React.FC<CardRightSlotProps> = ({
  type,
  quantity,
  unit,
  onIncrement,
  onDecrement,
  disabled = false,
  onDrag,
  children,
}) => {
  if (type === 'custom' && children) {
    return <View style={styles.container}>{children}</View>;
  }

  if (type === 'dragHandle' && onDrag) {
    return (
      <Pressable onLongPress={onDrag} style={styles.dragHandle}>
        <Icon name="reorder-three" size={24} tone="textTertiary" />
      </Pressable>
    );
  }

  // counter
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
          name="remove-outline"
          size={18}
          tone={disabled || quantity === 0 ? 'textTertiary' : 'primary'}
        />
      </Pressable>
      <View style={styles.counterValue}>
        <Text size="md" weight="semibold">
          {quantity || 0}
        </Text>
        {unit ? (
          <Text tone="secondary" style={styles.counterUnit}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onIncrement}
        disabled={disabled}
        style={[styles.counterButton, disabled && styles.counterButtonDisabled]}
      >
        <Icon
          name="add"
          size={18}
          tone={disabled ? 'textTertiary' : 'primary'}
        />
      </Pressable>
    </View>
  );
};

/**
 * Right slot component for BaseItemCard
 * Renders meta info, counter, drag handle, or custom content
 */
export const CardRightSlot: React.FC<CardRightSlotProps> = props => {
  const { type } = props;

  // Meta path is lightweight — no useUnistyles needed
  if (type === 'meta' || (!type && !props.children)) {
    return (
      <MetaSlot
        primary={props.primary}
        secondary={props.secondary}
        tertiary={props.tertiary}
      />
    );
  }

  // All other types need theme access
  return <InteractiveSlot {...props} />;
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginLeft: theme.spacing['3'],
  },
  metaContainer: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing['3'],
  },
  secondary: {
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
  counterUnit: {
    fontSize: theme.typography.fontSize.xs - 1,
  },
  dragHandle: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
}));
