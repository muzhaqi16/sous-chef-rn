import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
  const counts = [
    rating5Count,
    rating4Count,
    rating3Count,
    rating2Count,
    rating1Count,
  ];
  const maxCount = Math.max(...counts, 1);

  return (
    <View style={styles.container}>
      {/* Left: Average rating */}
      <View style={styles.averageSection}>
        <Text size="3xl" weight="bold">
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
        <Text size="xs" tone="secondary">
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
              <Text
                size="xs"
                tone="secondary"
                align="right"
                style={styles.barLabel}
              >
                {starLevel}
              </Text>
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
              <Text
                size="xs"
                tone="secondary"
                align="right"
                style={styles.barCount}
              >
                {count}
              </Text>
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
  starsRow: {
    flexDirection: 'row',
    marginVertical: theme.spacing.xs,
  },
  barsSection: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  barLabel: {
    width: 12,
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
    width: 24,
  },
}));
