import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';

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
  return (
    <View style={styles.statsContainer}>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text style={styles.statNumber}>{totalHomes}</Text>
        <Text style={styles.statLabel}>
          {totalHomes === 1 ? 'Home' : 'Homes'}
        </Text>
      </View>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text style={styles.statNumber}>{totalMembers}</Text>
        <Text style={styles.statLabel}>
          {totalMembers === 1 ? 'Member' : 'Members'}
        </Text>
      </View>
      <View style={[commonStyles.shadow, styles.statCard]}>
        <Text style={styles.statNumber}>{totalPantries}</Text>
        <Text style={styles.statLabel}>
          {totalPantries === 1 ? 'Pantry' : 'Pantries'}
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
  statNumber: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
