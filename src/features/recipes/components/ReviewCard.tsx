import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  RecipeReviewFragmentDoc,
  type RecipeReviewFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import { formatRelativeToNow } from '#/utils/formatters/date';
import { personName } from '#/utils/formatters/memberFormatters';
import { hitSlop } from '#/theme/foundations/sizes';
import { useUser } from '#store/useAppStore';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface ReviewCardProps {
  review: RecipeReviewFragment;
  isOwn: boolean;
  hasVotedHelpful: boolean;
  onToggleHelpful: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Offered only on a review someone other than the viewer wrote. */
  onReport?: (authorId: string) => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review: reviewSource,
  isOwn,
  hasVotedHelpful,
  onToggleHelpful,
  onEdit,
  onDelete,
  onReport,
}) => {
  const { t } = useTranslation();
  const viewer = useUser();
  // Re-renders only when this review's fragment fields change, and falls back
  // to the prop on a cache miss so a list cell never blanks.
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
  const displayName = user
    ? personName(user) ?? t('labels.someone')
    : t('labels.deletedUser');
  const avatar = user?.profile?.avatar;
  const authorId = user?.id;
  const reportable =
    !!onReport && !!viewer && !!authorId && authorId !== viewer.id;

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
                hitSlop={hitSlop.md}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityLabel={t('recipes.editReviewA11y')}
              >
                <Icon name="create-outline" size={18} tone="primary" />
              </Pressable>
            )}
            {!!onDelete && (
              <Pressable
                onPress={onDelete}
                hitSlop={hitSlop.md}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityLabel={t('recipes.deleteReviewA11y')}
              >
                <Icon name="trash-outline" size={18} tone="error" />
              </Pressable>
            )}
          </View>
        )}
        {!!reportable && (
          <Pressable
            onPress={() => onReport(authorId)}
            hitSlop={hitSlop.md}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t('reports.reportReview')}
            testID={recipesTestIDs.reviewReportButton(review.id)}
          >
            <Icon name="flag-outline" size={18} tone="textSecondary" />
          </Pressable>
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
    marginTop: theme.spacing['3xs'],
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
