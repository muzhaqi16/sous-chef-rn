import React from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { styles } from './dashboardStyles';

/** A titled dashboard section: heading, optional subtitle, then the metric. */
export const MetricCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <View style={styles.metricsSection}>
    <Text role="heading" style={styles.sectionTitle}>
      {title}
    </Text>
    {!!subtitle && (
      <Text role="caption" tone="secondary" style={styles.sectionSubtitle}>
        {subtitle}
      </Text>
    )}
    {children}
  </View>
);

/** A label/value pair inside a card's rounded panel. */
export const MetricRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <View style={styles.startupRow}>
    <Text role="caption" tone="secondary">
      {label}
    </Text>
    {children}
  </View>
);

/** The rounded panel label/value rows sit in. */
export const MetricPanel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <View style={styles.startupCard}>{children}</View>;
