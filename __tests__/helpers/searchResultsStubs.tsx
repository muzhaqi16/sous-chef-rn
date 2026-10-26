import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** The card as its item's name. */
export const ProductResultCard = ({ item }: { item: { name: string } }) => (
  <Text>{item.name}</Text>
);

/**
 * Each action as a button: `primary-btn` (its `disabled` as accessibility
 * state only, so a press still reaches the screen), `alternate-btn` and
 * `secondary-btn`.
 */
export const ActionButtons = ({
  primaryAction,
  alternateAction,
  secondaryAction,
}: {
  primaryAction?: Action;
  alternateAction?: Action;
  secondaryAction?: Action;
}) => (
  <View>
    {primaryAction ? (
      <Pressable
        testID="primary-btn"
        accessibilityState={{ disabled: !!primaryAction.disabled }}
        onPress={primaryAction.onPress}
      >
        <Text>{primaryAction.label}</Text>
      </Pressable>
    ) : null}
    {alternateAction ? (
      <Pressable testID="alternate-btn" onPress={alternateAction.onPress}>
        <Text>{alternateAction.label}</Text>
      </Pressable>
    ) : null}
    {secondaryAction ? (
      <Pressable testID="secondary-btn" onPress={secondaryAction.onPress}>
        <Text>{secondaryAction.label}</Text>
      </Pressable>
    ) : null}
  </View>
);

/** The unit field as its label and value: its list loads over the network. */
export const UnitAutocompleteField = ({
  label,
  value,
  error,
}: {
  label?: string;
  value: string;
  error?: string;
}) => (
  <View>
    <Text>{label}</Text>
    <Text>{value}</Text>
    {error ? <Text>{error}</Text> : null}
  </View>
);
