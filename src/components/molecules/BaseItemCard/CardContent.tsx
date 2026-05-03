import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { CardContentProps } from './types';
import { Text } from '#components/atoms/Text';

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
        style={[styles.title, isPurchased && styles.purchasedTitle]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!!subtitle &&
        (typeof subtitle === 'string' ? (
          <Text size="sm" tone="secondary" numberOfLines={1}>
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
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.xs,
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
