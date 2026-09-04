import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { ProgressBar } from '#components/atoms/ProgressBar';

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
  const { t } = useTranslation();
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
        <Text role="display">
          {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(star => (
            <Icon
              key={star}
              name={star <= Math.round(averageRating) ? 'star' : 'star-outline'}
              size={14}
              tone="rating"
            />
          ))}
        </View>
        <Text role="caption" tone="secondary">
          {t('recipes.reviewCount', { count: totalReviews })}
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
                role="caption"
                tone="secondary"
                align="right"
                style={styles.barLabel}
              >
                {starLevel}
              </Text>
              <ProgressBar
                value={ratio}
                tone="rating"
                style={styles.barTrack}
                accessibilityLabel={t('recipes.ratingBreakdownRow', {
                  stars: starLevel,
                  count,
                })}
              />
              <Text
                role="caption"
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
  },
  barCount: {
    width: 24,
  },
}));
