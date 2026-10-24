import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { CardRightSlotProps } from './types';
import { Text } from '#components/atoms/Text';
import { rowType } from '#/theme/foundations/type';

export const CardRightSlot: React.FC<CardRightSlotProps> = ({
  primary,
  secondary,
  testID,
}) => (
  <View style={styles.metaContainer}>
    {primary ? (
      <Text role={rowType.title} testID={testID} numberOfLines={1}>
        {primary}
      </Text>
    ) : null}
    {secondary ? (
      <Text role={rowType.subtitle} tone="tertiary" numberOfLines={1}>
        {secondary}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  metaContainer: {
    // Centred in the row like every other slot: beside a title and a status
    // line, the quantity sits level with the pair, as a list's trailing
    // detail does.
    alignItems: 'flex-end',
    // Bounded so a long secondary cannot squeeze the title, and single-line so
    // a wrapped one is ellipsized rather than clipped by the row's height.
    maxWidth: '40%',
  },
});
