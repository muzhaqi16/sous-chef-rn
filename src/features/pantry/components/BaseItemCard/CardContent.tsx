import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { CardContentProps } from './types';
import { Text } from '#components/atoms/Text';
import { rowType } from '#/theme/foundations/type';

/**
 * Content slot component for BaseItemCard
 * Renders title and optional subtitle
 */
export const CardContent: React.FC<CardContentProps> = ({
  title,
  subtitle,
  isPurchased = false,
}) => {
  styles.useVariants({ purchased: isPurchased });

  return (
    <View style={styles.container}>
      <Text
        role={rowType.title}
        style={[styles.title, isPurchased && styles.purchasedTitle]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!!subtitle &&
        (typeof subtitle === 'string' ? (
          <Text role={rowType.subtitle} tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginBottom: theme.layout.rowTextGap,
    color: theme.colors.textPrimary,
    variants: {
      purchased: {
        true: {
          color: theme.colors.textTertiary,
        },
        false: {
          color: theme.colors.textPrimary,
        },
      },
    },
  },
  purchasedTitle: {
    textDecorationLine: 'line-through',
  },
}));
