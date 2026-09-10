import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import {
  OnPrimaryActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { StarRatingInput } from './StarRatingInput';
import { Text } from '#components/atoms/Text';
import { WriteReviewSheet_ReviewFragmentDoc } from './WriteReviewSheet.generated';
import { Sheet } from '#components/templates/Sheet';

interface WriteReviewSheetProps {
  visible: boolean;
  existingReviewId?: string | null;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

/**
 * Writes or edits a recipe review, reading the existing one from the cache by
 * `existingReviewId`. Form state is seeded only when the sheet opens or the id
 * changes, so a cache update cannot overwrite the user's edits.
 */
export const WriteReviewSheet: React.FC<WriteReviewSheetProps> = ({
  visible,
  existingReviewId,
  onSubmit,
  onClose,
  submitting,
}) => {
  const { t } = useTranslation();

  const { data, complete } = useFragment({
    fragment: WriteReviewSheet_ReviewFragmentDoc,
    fragmentName: 'WriteReviewSheet_review',
    from: existingReviewId
      ? { __typename: 'RecipeReview', id: existingReviewId }
      : null,
  });
  const existingReview = existingReviewId && complete ? data : null;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Reset / populate form when sheet opens or the target review changes
  // (render-time state update). Keying on `existingReviewId` (not the
  // materialized object) means a cache update to the same review doesn't
  // clobber the user's in-progress edits.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevExistingReviewId, setPrevExistingReviewId] =
    useState(existingReviewId);
  if (visible !== prevVisible || existingReviewId !== prevExistingReviewId) {
    setPrevVisible(visible);
    setPrevExistingReviewId(existingReviewId);
    if (visible) {
      setRating(existingReview?.rating ?? 0);
      setComment(existingReview?.comment ?? '');
    }
  }

  const handleSubmit = async () => {
    if (submitting || rating === 0) return;
    await onSubmit(rating, comment.trim() || undefined);
    onClose();
  };

  const isEditing = !!existingReviewId;

  return (
    <Sheet
      mode="view"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['55%']}
      contentContainerStyle={styles.content}
    >
      <Text role="heading" style={styles.title}>
        {isEditing ? t('recipes.editReview') : t('recipes.writeReview')}
      </Text>

      {/* Rating */}
      <View style={styles.ratingSection}>
        <Text role="label" tone="secondary">
          {t('recipes.rating')}
        </Text>
        <StarRatingInput
          value={rating}
          onChange={setRating}
          size={36}
          disabled={submitting}
        />
      </View>

      {/* Comment */}
      <View style={styles.commentSection}>
        <Text role="label" tone="secondary">
          {t('recipes.commentOptional')}
        </Text>
        <ThemedBottomSheetTextInput
          defaultValue={comment}
          onChangeText={setComment}
          placeholder={t('recipes.reviewPlaceholder')}
          multiline
          numberOfLines={4}
          style={styles.textInput}
          editable={!submitting}
        />
      </View>

      {/* Submit */}
      <AppPressable
        onPress={handleSubmit}
        disabled={rating === 0 || submitting}
        style={[
          styles.submitButton,
          rating === 0 && styles.submitButtonDisabled,
        ]}
      >
        {submitting ? (
          <OnPrimaryActivityIndicator />
        ) : (
          <Text role="bodyStrong" style={styles.submitText}>
            {isEditing ? t('recipes.updateReview') : t('recipes.submitReview')}
          </Text>
        )}
      </AppPressable>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.lg,
  },
  ratingSection: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  commentSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  textInput: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: theme.colors.onPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
