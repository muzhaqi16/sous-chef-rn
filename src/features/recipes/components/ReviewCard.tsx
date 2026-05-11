import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import {
  RecipeReviewFragmentDoc,
  type RecipeReviewFragment,
} from '#features/recipes/graphql/recipeFragments.generated';

interface ReviewCardProps {
  review: RecipeReviewFragment;
  isOwn: boolean;
  hasVotedHelpful: boolean;
  onToggleHelpful: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review: reviewSource,
  isOwn,
  hasVotedHelpful,
  onToggleHelpful,
  onEdit,
  onDelete,
}) => {
  // Per-entity cache subscription: re-renders only when this review's
  // RecipeReviewFragment fields change (e.g., helpful count after a
  // toggleHelpful mutation, or comment/rating after an updateReview).
  // Falls back to the source prop on cache miss so list cells never blank out.
  const fragmentResult = useFragment({
    fragment: RecipeReviewFragmentDoc,
    fragmentName: 'RecipeReviewFragment',
    from: reviewSource,
  });
  const review = fragmentResult.complete ? fragmentResult.data : reviewSource;

  const displayName = review.user.profile?.displayName || review.user.email;
  const avatar = review.user.profile?.avatar;

  return (
    <View style={styles.container}>
      {/* Header: avatar, name, date */}
      <View style={styles.header}>
        {avatar ? (
          <CachedImage uri={avatar} style={styles.avatar} displaySize={36} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={16} tone="textSecondary" />
          </View>
        )}
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text size="sm" weight="semibold" numberOfLines={1}>
              {displayName}
            </Text>
            {!!review.verified && (
              <Icon name="checkmark-circle" size={14} tone="success" />
            )}
          </View>
          <Text size="xs" tone="secondary" style={styles.date}>
            {formatDistanceToNow(new Date(review.createdAt), {
              addSuffix: true,
            })}
          </Text>
        </View>
        {/* Own review actions */}
        {!!isOwn && (
          <View style={styles.ownActions}>
            {!!onEdit && (
              <Pressable
                onPress={onEdit}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Icon name="create-outline" size={18} tone="primary" />
              </Pressable>
            )}
            {!!onDelete && (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Icon name="trash-outline" size={18} tone="error" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Stars */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <Icon
            key={star}
            name={star <= review.rating ? 'star' : 'star-outline'}
            size={14}
            tone="rating"
          />
        ))}
      </View>

      {/* Comment */}
      {!!review.comment && (
        <Text size="sm" lineHeight="tight" style={styles.comment}>
          {review.comment}
        </Text>
      )}

      {/* Helpful button */}
      <Pressable
        onPress={onToggleHelpful}
        style={({ pressed }) => [
          hasVotedHelpful ? styles.helpfulButtonActive : styles.helpfulButton,
          pressed && styles.pressed,
        ]}
      >
        <Icon
          name={hasVotedHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
          size={14}
          tone={hasVotedHelpful ? 'primary' : 'textSecondary'}
        />
        <Text size="xs" tone={hasVotedHelpful ? 'accent' : 'secondary'}>
          Helpful{review.helpful > 0 ? ` (${review.helpful})` : ''}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  date: {
    marginTop: 1,
  },
  ownActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  comment: {
    marginBottom: theme.spacing.sm,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  helpfulButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
