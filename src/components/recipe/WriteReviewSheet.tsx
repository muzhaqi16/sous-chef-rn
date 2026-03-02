import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { StyleSheet } from 'react-native-unistyles';
import { StarRatingInput } from './StarRatingInput';
import type { RecipeReviewFragment } from '#generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

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
  submitting }) => {
  const { ref, modalProps, contentContainerStyle, theme } = useStandardBottomSheet({
    onDismiss: onClose,
    snapPoints: ['55%'],
    keyboardAware: true });

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

  // Present/dismiss bottom sheet
  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible, ref]);

  const handleSubmit = async () => {
    if (submitting || rating === 0) return;
    await onSubmit(rating, comment.trim() || undefined);
    onClose();
  };

  const isEditing = !!existingReview;

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetFormScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
      >
        <Text style={styles.title}>
          {isEditing ? 'Edit Review' : 'Write a Review'}
        </Text>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.label}>Rating</Text>
          <StarRatingInput
            value={rating}
            onChange={setRating}
            size={36}
            disabled={submitting}
          />
        </View>

        {/* Comment */}
        <View style={styles.commentSection}>
          <Text style={styles.label}>Comment (optional)</Text>
          <BottomSheetTextInput
            defaultValue={comment}
            onChangeText={setComment}
            placeholder="Share your thoughts about this recipe..."
            placeholderTextColor={theme.colors.textSecondary}
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
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>
              {isEditing ? 'Update Review' : 'Submit Review'}
            </Text>
          )}
        </Pressable>
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    padding: theme.spacing.lg },
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg },
  ratingSection: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary },
  commentSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center' },
  submitButtonDisabled: {
    opacity: 0.5 },
  submitText: {
    color: theme.colors.onPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold },
  pressed: {
    opacity: theme.opacity.pressed } }));
