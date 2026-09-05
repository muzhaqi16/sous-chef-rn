import React from 'react';
import { View } from 'react-native';
// RNGH's Pressable, not the themed RN re-export: these buttons render inside a
// BaseItemCard Swipeable, and RN's Pressable doesn't coordinate with RNGH's
// gesture arena. The trade-off is that the Unistyles plugin does not bind it to
// the ShadowTree, so a theme-derived style on it freezes at mount — every themed
// value lives on a wrapping `View` and this component carries only literals.
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { CardRightSlotProps } from './types';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { rowType } from '#/theme/foundations/type';

const MetaSlot: React.FC<
  Pick<CardRightSlotProps, 'primary' | 'secondary' | 'tertiary' | 'testID'>
> = ({ primary, secondary, tertiary, testID }) => (
  <View style={styles.metaContainer}>
    {primary ? (
      <Text role={rowType.title} testID={testID}>
        {primary}
      </Text>
    ) : null}
    {secondary ? (
      <Text role={rowType.subtitle} tone="tertiary">
        {secondary}
      </Text>
    ) : null}
    {tertiary ? (
      <Text role={rowType.subtitle} tone="tertiary">
        {tertiary}
      </Text>
    ) : null}
  </View>
);

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
  const { t } = useTranslation();
  if (type === 'custom' && children) {
    return <View>{children}</View>;
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
          accessibilityLabel={t('editableCounter.decrease')}
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
        <Text role={rowType.title}>{quantity || 0}</Text>
        {unit ? (
          <Text
            role={rowType.subtitle}
            tone="secondary"
            style={styles.counterUnit}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <View
        style={[styles.counterButton, disabled && styles.counterButtonDisabled]}
      >
        <Pressable
          onPress={onIncrement}
          accessibilityLabel={t('editableCounter.increase')}
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

export const CardRightSlot: React.FC<CardRightSlotProps> = props => {
  const { type } = props;

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

  return <InteractiveSlot {...props} />;
};

const styles = StyleSheet.create(theme => ({
  metaContainer: {
    alignItems: 'flex-end',
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
  counterUnit: {},
  dragHandle: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  // Literals only — this style lands on RNGH's Pressable, which the Unistyles
  // plugin does not bind to the ShadowTree, so themed values freeze at mount.
  fill: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
