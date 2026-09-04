import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface ChartSectionProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  title,
  children,
  loading = false,
  error,
  emptyMessage,
  isEmpty = false,
}) => {
  const { t } = useTranslation();
  const renderContent = () => {
    // Data outranks a request in flight, so a refetch does not blank a chart
    // that already has something to draw.
    if (loading && isEmpty) {
      return (
        <View style={styles.stateContainer}>
          <PrimaryActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Icon name="alert-circle-outline" size={40} tone="error" />
          <Text role="caption" align="center" tone="error">
            {error}
          </Text>
        </View>
      );
    }

    if (isEmpty) {
      return (
        <View style={styles.stateContainer}>
          <Icon name="bar-chart-outline" size={40} tone="textSecondary" />
          <Text role="caption" align="center" tone="secondary">
            {emptyMessage ?? t('labels.noDataAvailable')}
          </Text>
        </View>
      );
    }

    return children;
  };

  return (
    <View style={styles.container}>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
}));
