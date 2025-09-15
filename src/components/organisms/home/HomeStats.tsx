import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

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
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{totalHomes}</Text>
        <Text style={styles.statLabel}>
          {totalHomes === 1 ? 'Home' : 'Homes'}
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{totalMembers}</Text>
        <Text style={styles.statLabel}>
          {totalMembers === 1 ? 'Member' : 'Members'}
        </Text>
      </View>
      <View style={styles.statCard}>
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
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
}));
