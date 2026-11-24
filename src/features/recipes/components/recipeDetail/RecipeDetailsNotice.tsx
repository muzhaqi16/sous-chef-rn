import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import type { IconName } from '#components/atoms/Icon';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { RecipeDetailSkeleton } from '#features/recipes/components/skeletons/RecipeDetailSkeleton';
import type { RecipeDetails } from '#features/recipes/hooks/useRecipeData';

/** What a catalog recipe still lacks, above the parts it would fill. */
const DETAILS_NOTICE: Readonly<
  Record<
    Exclude<RecipeDetails, 'complete' | 'opening'>,
    { title: TranslationKey; subtitle: TranslationKey; icon: IconName }
  >
> = {
  pending: {
    title: 'recipes.catalogPendingTitle',
    subtitle: 'recipes.catalogPendingSubtitle',
    icon: 'hourglass-outline',
  },
  unavailable: {
    title: 'recipes.catalogUnavailableTitle',
    subtitle: 'recipes.catalogUnavailableSubtitle',
    icon: 'cloud-offline-outline',
  },
  held: {
    title: 'dataState.partialTitle',
    subtitle: 'dataState.partialBody',
    icon: 'cloud-offline-outline',
  },
};

export const RecipeDetailsNotice: React.FC<{
  details: RecipeDetails;
  saved: boolean;
}> = ({ details, saved }) => {
  const { t } = useTranslation();
  if (details === 'complete') return null;
  if (details === 'opening') return <RecipeDetailSkeleton />;
  const notice = DETAILS_NOTICE[details];
  // A saved recipe's fetch is already queued, so it is not asked to save.
  const subtitle: TranslationKey =
    details === 'pending' && saved
      ? 'recipes.catalogPendingSavedSubtitle'
      : notice.subtitle;
  return (
    <View style={styles.notice}>
      <AlertBanner
        title={t(notice.title)}
        subtitle={t(subtitle)}
        icon={notice.icon}
        iconLibrary="Ionicons"
        variant={details === 'pending' ? 'info' : 'warning'}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  notice: {
    marginBottom: theme.spacing.md,
  },
}));
