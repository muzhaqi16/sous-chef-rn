import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { CachedImage } from '#components/atoms/CachedImage';
import type { RecipeReviewFragment } from '#generated';
import { Text } from '#components/atoms/Text';

interface ReviewCardProps {
  review: RecipeReviewFragment;
  isOwn: boolean;
  hasVotedHelpful: boolean;
  onToggleHelpful: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  isOwn,
  hasVotedHelpful,
  onToggleHelpful,
  onEdit,
  onDelete,
}) => {
  const { theme } = useUnistyles();
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
            <Ionicons
              name="person"
              size={16}
              color={theme.colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text size="sm" weight="semibold" numberOfLines={1}>
              {displayName}
            </Text>
            {!!review.verified && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.colors.success}
              />
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
                style={({ pressed }) =>
                  pressed && { opacity: theme.opacity.pressed }
                }
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </Pressable>
            )}
            {!!onDelete && (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={({ pressed }) =>
                  pressed && { opacity: theme.opacity.pressed }
                }
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={theme.colors.error}
                />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Stars */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <Ionicons
            key={star}
            name={star <= review.rating ? 'star' : 'star-outline'}
            size={14}
            color={theme.colors.rating}
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
          pressed && { opacity: theme.opacity.pressed },
        ]}
      >
        <Ionicons
          name={hasVotedHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
          size={14}
          color={
            hasVotedHelpful ? theme.colors.primary : theme.colors.textSecondary
          }
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
}));
