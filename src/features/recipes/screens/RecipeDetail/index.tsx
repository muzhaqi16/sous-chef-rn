import { noteTipFact } from '#hooks/settings/useFeatureHint';
import React, { useEffect } from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { alertService } from '#services/alertService';
import { openWebUrl } from '#native/externalUrl';
import { Text } from '#components/atoms/Text';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { StyleSheet } from 'react-native-unistyles';
import { RecipeDetailErrorBoundary } from '#components/providers/ScreenErrorBoundary';
import { useAddToMealPlanSheet } from '#features/mealPlan/ui/useAddToMealPlanSheet';
import { useRecipeReviews } from '#features/recipes/hooks/useRecipeReviews';
import { ReviewSection } from '#features/recipes/components/ReviewSection';
import { useRecipeDetail } from './useRecipeDetail';
import { useActiveSheet } from '#hooks/ui/useActiveSheet';
import { useRecipeHeaderActions } from './useRecipeHeaderActions';
import type {
  CatalogRecipeHint,
  RecipeRowHint,
} from '#features/recipes/hooks/useOpenCatalogRecipe';
import { DataAttributionNotices } from '#features/recipes/components/DataAttributionNotices';
import { RecipeDetailSkeleton } from '#features/recipes/components/skeletons/RecipeDetailSkeleton';
import { RecipeEnrichment } from '#features/recipes/components/recipeDetail/RecipeEnrichment';
import { RecipeDetailsNotice } from '#features/recipes/components/recipeDetail/RecipeDetailsNotice';
import {
  RecipeDetailSheets,
  type RecipeSheet,
} from '#features/recipes/components/recipeDetail/RecipeDetailSheets';
import { RecipeIngredientsSection } from '#features/recipes/components/recipeDetail/RecipeIngredientsSection';
import { RecipeMetaRow } from '#features/recipes/components/recipeDetail/RecipeMetaRow';
import { DietaryCheckNote } from '#features/recipes/components/recipeDetail/DietaryCheckNote';
import { RecipeCredit } from '#features/recipes/components/recipeDetail/RecipeCredit';
import { useRecipeDietaryAlerts } from '#features/recipes/hooks/useRecipeDietaryAlerts';
import { CaptureReviewBanner } from '#features/recipes/components/capture/CaptureReviewBanner';
import { useCaptureSources } from '#features/recipes/hooks/useCaptureSources';
import { RecipeHeroImage } from '#features/recipes/components/recipeDetail/RecipeHeroImage';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import { SavedRecipeMetadataPanel } from '#features/recipes/components/recipeDetail/SavedRecipeMetadataPanel';
import { RecipeInstructions } from '#features/recipes/components/recipeDetail/RecipeInstructions';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { DataState } from '#hooks/data/useDataState';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { recipesTestIDs } from '#features/recipes/testIDs';

const RecipeDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useScreenTransition('RecipeDetail');

  const { toRecipeEdit } = useAppNavigation();
  const captureSources = useCaptureSources();
  const detail = useRecipeDetail();
  const {
    goBack,
    recipeId,
    catalogExternalId,
    loading,
    error,
    refreshing,
    handleRefresh,
    displayData,
    backendRecipe,
    isSaved,
  } = detail;
  const loadFailure = useOfflineAwareError(error ?? undefined, !!displayData);

  const { state: reviewState, actions: reviewActions } = useRecipeReviews({
    recipeId: recipeId ?? '',
    backendRecipe: backendRecipe ?? null,
  });

  // The source URL comes from the recipe provider or another member, so it is
  // opened only as a web address — any other scheme reaches a different app.
  const handleOpenSource = async () => {
    const opened = await openWebUrl(displayData?.sourceUrl);
    if (!opened) {
      alertService.alert(t('labels.error'), t('errors.linkNotOpenable'));
    }
  };

  // Opening a recipe is half of a new account's activation.
  useEffect(() => {
    if (recipeId) noteTipFact('recipeOpened');
  }, [recipeId]);

  const sheets = useActiveSheet<RecipeSheet>();
  const addToMealPlan = useAddToMealPlanSheet({ recipeId: recipeId ?? '' });
  const household = useRecipeDietaryAlerts(recipeId);
  const headerActions = useRecipeHeaderActions(
    detail,
    sheets.open,
    addToMealPlan.open,
  );

  // The full-screen loader only on a cold load: on a refetch `loading` is true
  // while `displayData` is already drawn from cache.
  if (loading && !displayData) {
    // Cold load renders inside the template shell so the pinned back chip
    // stays available during a slow fetch, matching the loaded state.
    return (
      <CollapsingHeroDetail
        testID={recipesTestIDs.recipeDetail}
        onBack={goBack}
        contentStyle={styles.recipeContent}
      >
        <RecipeDetailSkeleton showTitle />
      </CollapsingHeroDetail>
    );
  }

  // `displayData` first: a revalidation that fails while the recipe is cached
  // must not replace it with "not found" — which is what an offline open of a
  // cached recipe read as.
  if (!displayData) {
    // A failed read is the shared failure view; a recipe the server does not
    // have is an answer, said in its own words.
    const failed: DataState = loadFailure.offline
      ? 'offline'
      : error
      ? 'error'
      : 'empty';
    // Inside the template, so the back chip stays and a pull retries.
    return (
      <CollapsingHeroDetail
        testID={recipesTestIDs.recipeDetail}
        onBack={goBack}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        state={{
          value: failed,
          onRetry: handleRefresh,
          empty: {
            icon: 'alert-circle-outline',
            title:
              recipeId && !backendRecipe
                ? t('recipes.recipeNotFoundDb')
                : t('recipes.recipeNotFound'),
            description: t('errors.codes.genericRetry'),
            action: { label: t('labels.tryAgain'), onPress: handleRefresh },
          },
        }}
      >
        {null}
      </CollapsingHeroDetail>
    );
  }

  const heroImage = displayData.image;

  return (
    <>
      <CollapsingHeroDetail
        testID={recipesTestIDs.recipeDetail}
        onBack={goBack}
        actions={headerActions}
        title={displayData.title}
        contentStyle={styles.recipeContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        renderHero={
          heroImage
            ? heroHeight => (
                <RecipeHeroImage
                  imageUrl={heroImage}
                  externalId={catalogExternalId}
                  height={heroHeight}
                />
              )
            : undefined
        }
      >
        <DetailTitleRow
          flush
          title={displayData.title}
          style={styles.titleSpacing}
        />

        <RecipeMetaRow recipe={displayData} detail={detail} />

        <RecipeEnrichment
          caloriesPerServing={displayData.caloriesPerServing}
          nutrition={displayData.nutrition}
          tips={displayData.tips}
          videoUrl={displayData.videoUrl}
          forkedFromName={displayData.forkedFromName}
          tags={displayData.tags}
          status={displayData.status}
          reviewNote={displayData.reviewNote}
          hasPendingRevision={displayData.hasPendingRevision}
          revisionRejectionNote={displayData.revisionRejectionNote}
        />

        {!!isSaved && (
          <SavedRecipeMetadataPanel
            savedFolder={detail.savedFolder}
            savedTags={detail.savedTags}
            savedNotes={detail.savedNotes}
            savedRating={detail.savedRating}
            updatingFolderTags={detail.updatingFolderTags}
            onUpdateRating={detail.handleUpdateRating}
          />
        )}

        <RecipeDetailsNotice details={displayData.details} saved={isSaved} />

        {/* Dietary tags, from the provider's own data */}
        {[
          displayData.vegetarian,
          displayData.vegan,
          displayData.glutenFree,
          displayData.dairyFree,
        ].some(Boolean) && (
          <View style={styles.tags}>
            {!!displayData.vegetarian && (
              <View style={styles.tag}>
                <Text role="label" tone="onPrimaryLight">
                  {t('labels.vegetarian')}
                </Text>
              </View>
            )}
            {!!displayData.vegan && (
              <View style={styles.tag}>
                <Text role="label" tone="onPrimaryLight">
                  {t('labels.vegan')}
                </Text>
              </View>
            )}
            {!!displayData.glutenFree && (
              <View style={styles.tag}>
                <Text role="label" tone="onPrimaryLight">
                  {t('recipes.diet.GLUTEN_FREE')}
                </Text>
              </View>
            )}
            {!!displayData.dairyFree && (
              <View style={styles.tag}>
                <Text role="label" tone="onPrimaryLight">
                  {t('recipes.dairyFree')}
                </Text>
              </View>
            )}
          </View>
        )}

        <DietaryCheckNote
          check={household.check}
          flagged={household.flagged}
          restrictionsApply={household.restrictionsApply}
        />

        {/* Description */}
        {!!displayData.summary && (
          <View style={styles.section}>
            <SectionHeader style={styles.sectionTitleSpacing}>
              {t('recipes.about')}
            </SectionHeader>
            <Text role="body" style={styles.description}>
              {displayData.summary}
            </Text>
          </View>
        )}

        {recipeId && captureSources.any ? (
          <CaptureReviewBanner
            recipeId={recipeId}
            ingredients={displayData.ingredients}
            onReview={() => toRecipeEdit({ recipeId })}
          />
        ) : null}

        {displayData.ingredients.length > 0 && (
          <RecipeIngredientsSection
            ingredients={displayData.ingredients}
            detail={detail}
            household={household}
            onOpenFlagged={ingredient =>
              sheets.open({ type: 'ingredient', ingredient })
            }
          />
        )}

        <RecipeInstructions instructions={displayData.instructions} />

        {/* Reviews Section */}
        {!!backendRecipe && (
          <ReviewSection {...reviewState} {...reviewActions} />
        )}

        <RecipeCredit
          author={displayData.originalAuthor}
          sourceName={displayData.sourceName}
          sourceUrl={displayData.sourceUrl}
          onOpenSource={handleOpenSource}
        />

        {displayData.dataAttributions.length > 0 && (
          <View style={styles.dataAttributions}>
            <DataAttributionNotices
              attributions={displayData.dataAttributions}
              centered
            />
          </View>
        )}
      </CollapsingHeroDetail>

      <RecipeDetailSheets
        detail={detail}
        sheets={sheets}
        household={household}
        title={displayData.title}
        servings={displayData.servings}
        mealPlanSheet={addToMealPlan.element}
      />
    </>
  );
};

export const RecipeDetail: React.FC<
  StaticScreenProps<{
    recipeId?: string;
    /** What the row showed, for a recipe the device does not hold. */
    row?: RecipeRowHint;
    /** A catalog recipe the screen opens itself, shown as the row was. */
    catalog?: CatalogRecipeHint;
  }>
> = () => (
  <RecipeDetailErrorBoundary>
    <RecipeDetailScreen />
  </RecipeDetailErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  recipeContent: {
    paddingTop: theme.spacing.md,
  },
  titleSpacing: {
    marginBottom: theme.spacing.md,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tag: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  description: {
    color: theme.colors.textSecondary,
  },
  dataAttributions: {
    marginTop: theme.spacing.md,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.sm,
  },
}));
