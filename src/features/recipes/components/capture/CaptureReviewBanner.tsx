import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useCaptureReview } from '#features/recipes/hooks/useCaptureReview';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface CaptureReviewBannerProps {
  recipeId: string;
  ingredients: readonly {
    originalText?: string | null;
    item?: { id: string } | null;
  }[];
  /** Opens the recipe's editor, where a line is matched to an item. */
  onReview: () => void;
}

/**
 * On a recipe that came from a capture, while the capture is held: how its
 * measures were read, what the read warned of, and how many of its lines are
 * still unmatched. Nothing without a held capture.
 */
export const CaptureReviewBanner: React.FC<CaptureReviewBannerProps> = ({
  recipeId,
  ingredients,
  onReview,
}) => {
  const { t } = useTranslation();
  const { review } = useCaptureReview(recipeId);
  if (!review) return null;

  const unmatched = ingredients.filter(
    ingredient =>
      !ingredient.item &&
      review.candidatesFor(ingredient.originalText).length > 0,
  ).length;
  const notes = [review.measures, ...review.warnings].filter(
    (note): note is string => !!note,
  );

  return (
    <View style={styles.container} testID={recipesTestIDs.captureReview}>
      {notes.length > 0 ? (
        <AlertBanner
          title={t('recipes.captureReviewTitle')}
          subtitle={notes.join('\n')}
          icon="information-circle-outline"
          iconLibrary="Ionicons"
          variant="info"
        />
      ) : null}
      {unmatched > 0 ? (
        <AlertBanner
          title={t('recipes.captureUnlinked', { count: unmatched })}
          icon="link-outline"
          iconLibrary="Ionicons"
          variant="warning"
          onPress={onReview}
          showChevron
          testID={recipesTestIDs.captureReviewUnmatched}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
}));
