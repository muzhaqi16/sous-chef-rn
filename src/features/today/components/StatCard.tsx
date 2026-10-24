import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';

/** How urgent the figure is; it colours the number. */
export type StatTone = 'error' | 'warning' | 'info';

interface StatCardProps {
  count: number;
  label: string;
  tone: StatTone;
  /** Opens what the figure counts. Off at zero: there is nothing to open. */
  onPress: () => void;
  /** The figure as one phrase, such as "6 expired". */
  accessibilityLabel: string;
  testID?: string;
}

/** One summary figure: a number over its label, opening what it counts. */
export const StatCard: React.FC<StatCardProps> = ({
  count,
  label,
  tone,
  onPress,
  accessibilityLabel,
  testID,
}) => {
  const empty = count <= 0;
  return (
    <Card
      radius="xl"
      onPress={onPress}
      disabled={empty}
      accessibilityLabel={accessibilityLabel}
      style={styles.card}
      testID={testID}
    >
      <Text role="title" tone={empty ? 'tertiary' : tone}>
        {String(Math.max(count, 0))}
      </Text>
      <Text role="caption" tone="secondary" numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flex: 1,
    gap: theme.spacing['2xs'],
  },
}));
