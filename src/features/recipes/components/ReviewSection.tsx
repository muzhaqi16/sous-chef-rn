import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { RatingBreakdown } from './RatingBreakdown';
import { ReviewCard } from './ReviewCard';
import { WriteReviewSheet } from './WriteReviewSheet';
import type { RecipeReviewFragment } from '#generated';
import { Text } from '#components/atoms/Text';

interface ReviewSectionProps {
  reviews: RecipeReviewFragment[];
  totalReviews: number;
  averageRating: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  userReview: RecipeReviewFragment | null;
  hasReviewed: boolean;
  isOwnRecipe: boolean;
  createReview: (rating: number, comment?: string) => Promise<void>;
  updateReview: (
    id: string,
    input: { rating?: number; comment?: string },
  ) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  toggleHelpful: (reviewId: string, isHelpful: boolean) => Promise<void>;
  hasVotedHelpful: (review: RecipeReviewFragment) => boolean;
  submitting: boolean;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  reviews,
  totalReviews,
  averageRating,
  rating1Count,
  rating2Count,
  rating3Count,
  rating4Count,
  rating5Count,
  userReview,
  hasReviewed,
  isOwnRecipe,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  hasVotedHelpful,
  submitting,
}) => {
  const { theme } = useUnistyles();
  const [sheetVisible, setSheetVisible] = useState(false);

  // Other reviews (excluding user's own)
  const otherReviews = userReview
    ? reviews.filter(r => r.id !== userReview.id)
    : reviews;

  const handleSubmit = async (rating: number, comment?: string) => {
    if (hasReviewed && userReview) {
      await updateReview(userReview.id, { rating, comment });
    } else {
      await createReview(rating, comment);
    }
  };

  const handleDelete = () => {
    if (!userReview) return;
    alertService.alert(
      'Delete Review',
      'Are you sure you want to delete your review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteReview(userReview.id),
        },
      ],
    );
  };

  if (isOwnRecipe) return null;

  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Reviews
      </Text>

      {/* Rating Breakdown */}
      <RatingBreakdown
        averageRating={averageRating}
        totalReviews={totalReviews}
        rating1Count={rating1Count}
        rating2Count={rating2Count}
        rating3Count={rating3Count}
        rating4Count={rating4Count}
        rating5Count={rating5Count}
      />

      {/* User's own review or Write button */}
      {hasReviewed && userReview ? (
        <View style={styles.ownReviewSection}>
          <Text
            size="sm"
            weight="semibold"
            tone="accent"
            style={styles.ownReviewLabel}
          >
            Your Review
          </Text>
          <ReviewCard
            review={userReview}
            isOwn
            hasVotedHelpful={false}
            onToggleHelpful={() => {}}
            onEdit={() => setSheetVisible(true)}
            onDelete={handleDelete}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={({ pressed }) => [
            styles.writeButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text size="sm" weight="semibold" tone="accent">
            Write a Review
          </Text>
        </Pressable>
      )}

      {/* Other reviews */}
      {otherReviews.length > 0 && (
        <View style={styles.reviewsList}>
          {otherReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwn={false}
              hasVotedHelpful={hasVotedHelpful(review)}
              onToggleHelpful={() =>
                toggleHelpful(review.id, !hasVotedHelpful(review))
              }
            />
          ))}
        </View>
      )}

      {totalReviews === 0 && !hasReviewed && (
        <Text
          size="sm"
          tone="secondary"
          align="center"
          style={styles.emptyText}
        >
          No reviews yet. Be the first to review this recipe!
        </Text>
      )}

      {/* Write/Edit Review Sheet */}
      <WriteReviewSheet
        visible={sheetVisible}
        existingReview={userReview}
        onSubmit={handleSubmit}
        onClose={() => setSheetVisible(false)}
        submitting={submitting}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  ownReviewSection: {
    marginTop: theme.spacing.md,
  },
  ownReviewLabel: {
    marginBottom: theme.spacing.xs,
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    borderStyle: 'dashed',
  },
  reviewsList: {
    marginTop: theme.spacing.sm,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
