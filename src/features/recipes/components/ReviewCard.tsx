import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import {
  RecipeReviewFragmentDoc,
  type RecipeReviewFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import { formatRelativeToNow } from '#/utils/formatters/date';

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
  const { t } = useTranslation();
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

  // User fields are inlined in RecipeReviewFragment, so direct field reads.
  // `user` is null once the author permanently deletes their account — the
  // review stays and still counts toward the recipe's rating totals.
  const user = review.user;
  // `user.email` only resolves for the viewer's own record, so it's null on
  // every other author's review — the literal fallback is what actually renders.
  const displayName = user
    ? user.profile?.displayName || user.email || t('labels.someone')
    : t('labels.deletedUser');
  const avatar = user?.profile?.avatar;

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
            <Text role="label" numberOfLines={1}>
              {displayName}
            </Text>
            {!!review.verified && (
              <Icon name="checkmark-circle" size={14} tone="success" />
            )}
          </View>
          <Text role="caption" tone="secondary" style={styles.date}>
            {formatRelativeToNow(new Date(review.createdAt))}
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
                accessibilityLabel={t('recipes.editReviewA11y')}
              >
                <Icon name="create-outline" size={18} tone="primary" />
              </Pressable>
            )}
            {!!onDelete && (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityLabel={t('recipes.deleteReviewA11y')}
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
        <Text role="caption" style={styles.comment}>
          {review.comment}
        </Text>
      )}
      {/* Helpful button */}
      <AppPressable
        onPress={onToggleHelpful}
        style={
          hasVotedHelpful ? styles.helpfulButtonActive : styles.helpfulButton
        }
      >
        <Icon
          name={hasVotedHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
          size={14}
          tone={hasVotedHelpful ? 'primary' : 'textSecondary'}
        />
        <Text role="caption" tone={hasVotedHelpful ? 'accent' : 'secondary'}>
          {review.helpful > 0
            ? t('recipes.helpfulWithCount', { count: review.helpful })
            : t('recipes.helpful')}
        </Text>
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
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
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
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
    borderWidth: theme.borderWidth.hairline,
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
