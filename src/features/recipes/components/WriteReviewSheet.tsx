import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import {
  OnPrimaryActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { StarRatingInput } from './StarRatingInput';
import { type RecipeReviewFragment } from '#features/recipes/graphql/recipeFragments.generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

interface WriteReviewSheetProps {
  visible: boolean;
  existingReview?: RecipeReviewFragment | null;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

export const WriteReviewSheet: React.FC<WriteReviewSheetProps> = ({
  visible,
  existingReview,
  onSubmit,
  onClose,
  submitting,
}) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['55%'],
    keyboardBehavior: 'interactive',
  });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Reset / populate form when sheet opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevExistingReview, setPrevExistingReview] = useState(existingReview);
  if (visible !== prevVisible || existingReview !== prevExistingReview) {
    setPrevVisible(visible);
    setPrevExistingReview(existingReview);
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

  const isEditing = !!existingReview;

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        <Text size="lg" weight="semibold" style={styles.title}>
          {isEditing ? 'Edit Review' : 'Write a Review'}
        </Text>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text size="sm" weight="medium" tone="secondary">
            Rating
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
          <Text size="sm" weight="medium" tone="secondary">
            Comment (optional)
          </Text>
          <ThemedBottomSheetTextInput
            defaultValue={comment}
            onChangeText={setComment}
            placeholder="Share your thoughts about this recipe..."
            multiline
            numberOfLines={4}
            style={styles.textInput}
            editable={!submitting}
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          style={({ pressed }) => [
            styles.submitButton,
            rating === 0 && styles.submitButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {submitting ? (
            <OnPrimaryActivityIndicator />
          ) : (
            <Text size="md" weight="semibold" style={styles.submitText}>
              {isEditing ? 'Update Review' : 'Submit Review'}
            </Text>
          )}
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
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
