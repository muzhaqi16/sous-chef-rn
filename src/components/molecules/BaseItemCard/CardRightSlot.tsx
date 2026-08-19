import React from 'react';
import { View } from 'react-native';
// RNGH's Pressable (not the themed RN re-export): the counter/drag-handle
// buttons can be rendered inside a BaseItemCard Swipeable, and RN's Pressable
// doesn't coordinate with RNGH's gesture arena (swipe blocks / tap double-fires
// the row). See the SwipeableItem convention in CLAUDE.md.
//
// The trade-off is that the Unistyles babel plugin binds React Native's
// components to the C++ ShadowTree, not this one — so a theme-derived style
// sitting on this Pressable is resolved once and never updated, and a live
// theme switch leaves these buttons painted in the previous theme while the
// row around them changes. Every themed value therefore lives on a wrapping
// `View`, and this component carries only literals.
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { CardRightSlotProps } from './types';
import { Text } from '#components/atoms/Text';

/**
 * Lightweight meta slot — no useUnistyles, all colors from stylesheet
 */
const MetaSlot: React.FC<
  Pick<CardRightSlotProps, 'primary' | 'secondary' | 'tertiary' | 'testID'>
> = ({ primary, secondary, tertiary, testID }) => (
  <View style={styles.metaContainer}>
    {primary ? (
      <Text size="base" weight="semibold" testID={testID}>
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
 * Interactive slot — uses Icon `tone` for theme-reactive colors
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
      <View style={styles.dragHandle}>
        <Pressable onLongPress={onDrag} style={styles.fill}>
          <Icon name="reorder-three" size={24} tone="textTertiary" />
        </Pressable>
      </View>
    );
  }

  // counter
  return (
    <View style={styles.counterContainer}>
      <View
        style={[
          styles.counterButton,
          (disabled || quantity === 0) && styles.counterButtonDisabled,
        ]}
      >
        <Pressable
          onPress={onDecrement}
          disabled={disabled || quantity === 0}
          style={styles.fill}
        >
          <Icon
            name="remove-outline"
            size={18}
            tone={disabled || quantity === 0 ? 'textTertiary' : 'primary'}
          />
        </Pressable>
      </View>
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
      <View
        style={[styles.counterButton, disabled && styles.counterButtonDisabled]}
      >
        <Pressable
          onPress={onIncrement}
          disabled={disabled}
          style={styles.fill}
        >
          <Icon
            name="add"
            size={18}
            tone={disabled ? 'textTertiary' : 'primary'}
          />
        </Pressable>
      </View>
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
        testID={props.testID}
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
    borderCurve: 'continuous',
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
  // Literals only: this is the style that lands on RNGH's Pressable, which the
  // Unistyles plugin does not bind to the ShadowTree. Anything theme-derived
  // here would freeze at whatever theme was active when the row mounted.
  fill: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
