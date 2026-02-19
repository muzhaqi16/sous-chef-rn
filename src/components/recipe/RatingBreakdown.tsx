import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface RatingBreakdownProps {
  averageRating: number;
  totalReviews: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
}

export const RatingBreakdown: React.FC<RatingBreakdownProps> = ({
  averageRating,
  totalReviews,
  rating1Count,
  rating2Count,
  rating3Count,
  rating4Count,
  rating5Count,
}) => {
  const { theme } = useUnistyles();
  const counts = [rating5Count, rating4Count, rating3Count, rating2Count, rating1Count];
  const maxCount = Math.max(...counts, 1);

  return (
    <View style={styles.container}>
      {/* Left: Average rating */}
      <View style={styles.averageSection}>
        <Text style={styles.averageNumber}>
          {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(star => (
            <Ionicons
              key={star}
              name={star <= Math.round(averageRating) ? 'star' : 'star-outline'}
              size={14}
              color={theme.colors.rating}
            />
          ))}
        </View>
        <Text style={styles.totalText}>
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </Text>
      </View>

      {/* Right: Bar chart */}
      <View style={styles.barsSection}>
        {counts.map((count, index) => {
          const starLevel = 5 - index;
          const ratio = totalReviews > 0 ? count / maxCount : 0;
          return (
            <View key={starLevel} style={styles.barRow}>
              <Text style={styles.barLabel}>{starLevel}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${ratio * 100}%`,
                      backgroundColor: theme.colors.rating,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  averageSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  averageNumber: {
    fontSize: theme.fonts.size['3xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: theme.spacing.xs,
  },
  totalText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  barsSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  barLabel: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    width: 12,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: theme.radii.sm,
  },
  barCount: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    width: 24,
    textAlign: 'right',
  },
}));
