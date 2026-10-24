import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface PackSize {
  netWeight: number;
  netWeightUnitId: string;
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

/**
 * The pack-size sheet as `pack-size-stub`, which confirms `size` when pressed
 * and closes as the real sheet does: only on `done`.
 */
export const packSizeSheetConfirming =
  <Outcome extends { status: string }>(
    size: PackSize,
    onOutcome?: (outcome: Outcome) => void,
  ) =>
  ({
    visible,
    onConfirm,
    onDismiss,
  }: {
    visible: boolean;
    onConfirm: (confirmed: PackSize) => Promise<Outcome>;
    onDismiss: () => void;
  }) => {
    if (!visible) return null;
    const confirm = async () => {
      const outcome = await onConfirm(size);
      onOutcome?.(outcome);
      if (outcome.status === 'done') onDismiss();
    };
    return (
      <Pressable testID="pack-size-stub" onPress={confirm}>
        <Text>size</Text>
      </Pressable>
    );
  };
