import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

interface HomeStatsProps {
  totalHomes: number;
  totalMembers: number;
  totalPantries: number;
}

export const HomeStats: React.FC<HomeStatsProps> = ({
  totalHomes,
  totalMembers,
  totalPantries,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.statsContainer}>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text size="2xl" weight="bold" tone="accent">
          {totalHomes}
        </Text>
        <Text size="xs" tone="secondary" style={styles.statLabel}>
          {t('homeManagement.statsHome', { count: totalHomes })}
        </Text>
      </View>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text size="2xl" weight="bold" tone="accent">
          {totalMembers}
        </Text>
        <Text size="xs" tone="secondary" style={styles.statLabel}>
          {t('homeManagement.statsMember', { count: totalMembers })}
        </Text>
      </View>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text size="2xl" weight="bold" tone="accent">
          {totalPantries}
        </Text>
        <Text size="xs" tone="secondary" style={styles.statLabel}>
          {t('homeManagement.statsPantry', { count: totalPantries })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing['3'],
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  statLabel: {
    marginTop: theme.spacing.xs,
  },
}));
