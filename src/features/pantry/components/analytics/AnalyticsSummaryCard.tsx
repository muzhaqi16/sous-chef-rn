import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedIcon } from '#components/atoms/themedComponents';
import type { IconName } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { Card } from '#components/atoms/Card';

interface AnalyticsSummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: IconName;
  color?: string;
}

export const AnalyticsSummaryCard: React.FC<AnalyticsSummaryCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
}) => {
  return (
    <Card radius="md" style={styles.card}>
      <View style={styles.header}>
        {!!icon && (
          <View
            style={[
              styles.iconContainer,
              !!color && { backgroundColor: color + '20' },
            ]}
          >
            <ThemedIcon
              name={icon}
              size={20}
              uniProps={t => ({ color: color ?? t.colors.primary })}
            />
          </View>
        )}
        <Text
          role="label"
          tone="secondary"
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Text role="title">{value}</Text>
      {!!subtitle && (
        <Text role="caption" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flex: 1,
    minWidth: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '20',
  },
  title: {
    flex: 1,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
}));
