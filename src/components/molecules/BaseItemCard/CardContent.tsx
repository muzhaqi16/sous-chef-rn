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
          { color: isPurchased ? theme.colors.textTertiary : '#1F2937' },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle && (
        typeof subtitle === 'string' ? (
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
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: 2,
  },
  purchasedTitle: {
    textDecorationLine: 'line-through',
  },
  subtitle: {
    fontSize: 13,
  },
}));
