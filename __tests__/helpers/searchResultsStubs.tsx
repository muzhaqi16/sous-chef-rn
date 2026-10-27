import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** The card as its item's name, and the brand's list action when it has one. */
export const ProductResultCard = ({
  item,
  brandLists,
}: {
  item: { name: string };
  brandLists?: { onAddToList: () => void };
}) => (
  <View>
    <Text>{item.name}</Text>
    {brandLists ? (
      <Pressable testID="add-brand-to-list" onPress={brandLists.onAddToList} />
    ) : null}
  </View>
);

/**
 * Each action as a button: `primary-btn` (its `disabled` as accessibility
 * state only, so a press still reaches the screen) and `alternate-btn`.
 */
export const ActionButtons = ({
  primaryAction,
  alternateAction,
}: {
  primaryAction: Action;
  alternateAction?: Action;
}) => (
  <View>
    <Pressable
      testID="primary-btn"
      accessibilityState={{ disabled: !!primaryAction.disabled }}
      onPress={primaryAction.onPress}
    >
      <Text>{primaryAction.label}</Text>
    </Pressable>
    {alternateAction ? (
      <Pressable testID="alternate-btn" onPress={alternateAction.onPress}>
        <Text>{alternateAction.label}</Text>
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
