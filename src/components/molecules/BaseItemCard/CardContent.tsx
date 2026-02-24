import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { CardContentProps } from './types';

/**
 * Content slot component for BaseItemCard
 * Renders title and optional subtitle
 */
export const CardContent: React.FC<CardContentProps> = ({
  title,
  subtitle,
  isPurchased = false,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          isPurchased && styles.purchasedTitle,
          { color: isPurchased ? theme.colors.textTertiary : theme.colors.textPrimary },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!!subtitle && (typeof subtitle === 'string' ? (
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.textSecondary },
            ]}
            numberOfLines={1}
          >
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
  },
  purchasedTitle: {
    textDecorationLine: 'line-through',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
  },
}));
