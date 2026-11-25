import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { Controller, useController, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { number, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { StarRatingInput } from './StarRatingInput';
import { Text } from '#components/atoms/Text';
import { WriteReviewSheet_ReviewFragmentDoc } from './WriteReviewSheet.generated';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { lazyMessage, reportValidationErrors } from '#utils/validation/common';

interface ReviewFormValues {
  /** 0 until a star is picked. */
  rating: number;
  comment: string;
}

const reviewSchema: ObjectSchema<ReviewFormValues> = object({
  rating: number().defined().min(1, lazyMessage('recipes.ratingRequired')),
  comment: string().trim().defined(),
});

interface WriteReviewSheetProps {
  visible: boolean;
  existingReviewId?: string | null;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

type ReviewFormProps = Omit<WriteReviewSheetProps, 'visible'>;

/**
 * One opening, seeded from the review the cache holds then: a later cache
 * update to it does not overwrite what is being typed.
 */
const ReviewForm: React.FC<ReviewFormProps> = ({
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

  const { control, handleSubmit } = useForm<ReviewFormValues>({
    resolver: yupResolver(reviewSchema),
    defaultValues: {
      rating: existingReview?.rating ?? 0,
      comment: existingReview?.comment ?? '',
    },
  });
  const { field: rating, fieldState: ratingState } = useController({
    control,
    name: 'rating',
  });

  const submit = handleSubmit(async ({ rating: stars, comment }) => {
    await onSubmit(stars, comment || undefined);
    onClose();
  }, reportValidationErrors);

  const isEditing = !!existingReviewId;

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={isEditing ? t('recipes.editReview') : t('recipes.writeReview')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void submit();
            },
            accessibilityLabel: isEditing
              ? t('recipes.updateReview')
              : t('recipes.submitReview'),
            loading: submitting,
          }}
        />
      </SheetHeaderSlot>

      {/* Rating */}
      <View style={styles.ratingSection}>
        <Text role="label" tone="secondary">
          {t('recipes.rating')}
        </Text>
        <StarRatingInput
          value={rating.value}
          onChange={rating.onChange}
          size="lg"
          disabled={submitting}
        />
        {ratingState.error ? (
          <Text role="error" tone="error">
            {ratingState.error.message}
          </Text>
        ) : null}
      </View>

      {/* Comment */}
      <View style={styles.commentSection}>
        <Text role="label" tone="secondary">
          {t('recipes.commentOptional')}
        </Text>
        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <ThemedBottomSheetTextInput
              defaultValue={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('recipes.reviewPlaceholder')}
              multiline
              numberOfLines={4}
              style={styles.textInput}
              editable={!submitting}
            />
          )}
        />
      </View>
    </>
  );
};

/** Writes or edits a recipe review, reading the existing one from the cache. */
export const WriteReviewSheet: React.FC<WriteReviewSheetProps> = ({
  visible,
  ...form
}) => {
  const opening = useOpening(visible, form.existingReviewId);

  return (
    <Sheet
      mode="view"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['55%']}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <ReviewForm
          key={opening.id}
          {...form}
          existingReviewId={opening.payload}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    padding: theme.spacing.lg,
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
}));
