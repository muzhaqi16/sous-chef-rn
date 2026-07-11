import React, { useState } from 'react';
import { View, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { DetailTitleRow } from '#components/molecules/DetailTitleRow';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';

const SuccessActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.success,
}));

import { FolderPicker } from '#components/molecules/FolderPicker';
import { RecipeDetailErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { MarkCookedModal } from '#/components/modals/MarkCookedModal';
import { IngredientMatchingSheet } from '#/components/modals/IngredientMatchingSheet';
import { SaveRecipeSheet } from '#/components/modals/SaveRecipeSheet/SaveRecipeSheet';
import { ManageRecipeSheet } from '#/components/modals/ManageRecipeSheet/ManageRecipeSheet';
import { AddToMealPlanSheet } from '#components/modals/AddToMealPlanSheet/AddToMealPlanSheet';
import { useRecipeFolders } from '#features/recipes/hooks/useRecipeFolders';
import { useRecipeTags } from '#features/recipes/hooks/useRecipeTags';
import { useRecipeReviews } from '#features/recipes/hooks/useRecipeReviews';
import { ReviewSection } from '#features/recipes/components/ReviewSection';

import { useRecipeDetail } from '../../hooks/useRecipeDetail';
import { useForkRecipe } from '#features/recipes/hooks/useForkRecipe';
import { usePublishRecipe } from '#features/recipes/hooks/usePublishRecipe';
import { RecipeEnrichment } from './components/RecipeEnrichment';
import { IngredientCard } from './components/IngredientCard';
import { RecipeHeroImage } from './components/RecipeHeroImage';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
import { SavedRecipeMetadataPanel } from './components/SavedRecipeMetadataPanel';
import { RecipeInstructions } from './components/RecipeInstructions';
import { ShoppingListPickerSheet } from './components/ShoppingListPickerSheet';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useUser } from '#store/useAppStore';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { EmptyState } from '#components/base/EmptyState';

const IngredientSeparator = () => <View style={{ width: 12 }} />;

const RecipeDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useScreenTransition('RecipeDetail');

  const { toRecipeEdit, toRecipeDetail } = useAppNavigation();
  const user = useUser();
  const { forkRecipe, forking } = useForkRecipe();
  const { setPublished, publishing } = usePublishRecipe();
  const {
    goBack,
    recipeId,
    externalId,
    loading,
    error,
    backendError,
    displayData,
    isBackendRecipe,
    backendRecipe,
    saving,
    isSaved,
    handleSaveRecipe,
    shoppingLists,
    addingToList,
    addedIngredients,
    handleAddSingleIngredient,
    handleAddAll,
    handleListSelected,
    creatingList,
    handleCreateListAndAddIngredients,
    listPickerVisible,
    handleSheetDismiss,
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
    handleSkipReview,
    ingredientMatching,
    showFolderPicker,
    setShowFolderPicker,
    updatingFolderTags,
    handleUpdateFolder,
    handleUpdateTags,
    handleUpdateNotes,
    handleUpdateRating,
    savedFolder,
    savedTags,
    savedNotes,
    savedRating,
    cookedCount,
    handleUnfavoriteRecipe,
  } = useRecipeDetail();

  // Scroll component for FlashList instances rendered inside bottom sheets.
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // Get available folders and tags for picker and autocomplete
  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();

  // Recipe reviews
  const { state: reviewState, actions: reviewActions } = useRecipeReviews({
    recipeId: recipeId ?? '',
    backendRecipe: backendRecipe ?? null,
  });

  // Derive icon visibility state
  const isInFavorites = isSaved && savedFolder === 'Favorites';
  const isInOtherFolder =
    isSaved && !!savedFolder && savedFolder !== 'Favorites';
  const showHeartIcon = !isSaved || isInFavorites || !savedFolder;
  const showFolderIcon = !isSaved || isInOtherFolder || !savedFolder;

  // Check if user is recipe creator (can edit)
  const isOwner = isBackendRecipe && backendRecipe?.createdBy?.id === user?.id;

  const handleEditRecipe = () => {
    if (recipeId) {
      toRecipeEdit({ recipeId });
    }
  };

  // Fork a recipe into an editable copy, then open the new copy.
  const handleForkRecipe = async () => {
    if (!recipeId) return;
    const newId = await forkRecipe(recipeId);
    if (newId) toRecipeDetail({ recipeId: newId });
  };

  const handleTogglePublish = () => {
    if (recipeId) setPublished(recipeId, !displayData?.isPublished);
  };

  // State for save/manage recipe sheets
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [showAddToMealPlanSheet, setShowAddToMealPlanSheet] = useState(false);

  // Handle heart icon press - quick save to Favorites or manage if already in Favorites
  const handleHeartPress = () => {
    if (saving || updatingFolderTags) return;

    if (isInFavorites) {
      // Saved in Favorites - open manage sheet
      setShowManageSheet(true);
    } else {
      // Not saved - quick save to "Favorites" folder
      handleSaveRecipe('Favorites');
    }
  };

  // Handle folder icon press - show advanced options
  const handleFolderPress = () => {
    if (saving || updatingFolderTags) return;

    if (isSaved) {
      // Already saved - show manage sheet
      setShowManageSheet(true);
    } else {
      // Not saved - show save sheet with folder/tag options
      setShowSaveSheet(true);
    }
  };

  // Handle save from SaveRecipeSheet
  const handleConfirmSave = async (options: {
    folder?: string;
    tags?: string[];
    notes?: string;
  }) => {
    await handleSaveRecipe(options.folder ?? null, options.tags, options.notes);
    setShowSaveSheet(false);
  };

  // Handle close save sheet
  const handleCloseSaveSheet = () => {
    setShowSaveSheet(false);
  };

  // Handle close manage sheet
  const handleCloseManageSheet = () => {
    setShowManageSheet(false);
  };

  // Pinned action chips for the collapsing hero bar.
  const headerActions: HeaderAction[] = [
    ...(recipeId
      ? [
          {
            icon: 'calendar-outline',
            onPress: () => setShowAddToMealPlanSheet(true),
            variant: 'primary',
            accessibilityLabel: t('recipes.addToMealPlanA11y'),
            testID: 'recipe-mealplan-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...(isOwner
      ? [
          {
            icon: 'create-outline',
            onPress: handleEditRecipe,
            variant: 'primary',
            testID: 'recipe-edit-button',
          } satisfies HeaderAction,
          {
            icon: displayData?.isPublished
              ? 'cloud-done-outline'
              : 'cloud-upload-outline',
            onPress: handleTogglePublish,
            variant: 'primary',
            loading: publishing,
            accessibilityLabel: displayData?.isPublished
              ? t('recipes.unpublishA11y')
              : t('recipes.publishA11y'),
            testID: 'recipe-publish-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...(isBackendRecipe && !isOwner && recipeId
      ? [
          {
            icon: 'git-branch-outline',
            onPress: handleForkRecipe,
            variant: 'primary',
            loading: forking,
            accessibilityLabel: t('recipes.forkA11y'),
            testID: 'recipe-fork-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...(showFolderIcon
      ? [
          {
            icon: isInOtherFolder ? 'folder' : 'folder-outline',
            onPress: handleFolderPress,
            variant: 'primary',
            disabled: saving || updatingFolderTags,
            testID: 'recipe-folder-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...(showHeartIcon
      ? [
          {
            icon: isInFavorites ? 'heart' : 'heart-outline',
            onPress: handleHeartPress,
            tone: 'favorite',
            loading: saving || updatingFolderTags,
            testID: 'recipe-heart-button',
          } satisfies HeaderAction,
        ]
      : []),
  ];

  // Only block on the full-screen loader during a true cold load. On a
  // cache-and-network refetch `loading` is true while `displayData` is already
  // materialized from cache — showing the loader there wipes the rendered
  // recipe and pops it back, which is the most-felt skeleton↔content flicker.
  if (loading && !displayData) {
    // Cold load renders inside the template shell so the pinned back chip
    // stays available during a slow fetch, matching the loaded state.
    return (
      <CollapsingHeroDetail testID="recipe-detail" onBack={goBack}>
        <View style={styles.centerContainer}>
          <SousChefLoader
            size="small"
            showBrand={false}
            message={t('recipes.loadingRecipe')}
          />
        </View>
      </CollapsingHeroDetail>
    );
  }

  if (error || backendError || !displayData) {
    const errorMessage =
      error ||
      backendError?.message ||
      (recipeId && !backendRecipe
        ? t('recipes.recipeNotFoundDb')
        : t('recipes.recipeNotFound'));

    return (
      <View style={styles.centerContainer}>
        <EmptyState
          icon="alert-circle-outline"
          title={errorMessage}
          description={t('errors.somethingWentWrong')}
          action={{ label: t('labels.goBack'), onPress: goBack }}
        />
      </View>
    );
  }

  const heroImage = displayData.image;

  return (
    <>
      <CollapsingHeroDetail
        testID="recipe-detail"
        onBack={goBack}
        actions={headerActions}
        title={displayData.title ?? ''}
        contentStyle={styles.recipeContent}
        renderHero={
          heroImage
            ? heroHeight => (
                <RecipeHeroImage
                  imageUrl={heroImage}
                  externalId={externalId}
                  height={heroHeight}
                />
              )
            : undefined
        }
      >
        <DetailTitleRow
          flush
          title={displayData.title ?? ''}
          style={styles.titleSpacing}
        />

        {/* Recipe Metadata */}
        <View style={styles.metadata}>
          {displayData.servings != null && (
            <Text style={styles.metadataText}>
              🍽️ {displayData.servings} {t('recipes.servingsSuffix')}
            </Text>
          )}
          {!!displayData.readyInMinutes && (
            <Text style={styles.metadataText}>
              ⏱️ {displayData.readyInMinutes} {t('recipes.minutes')}
            </Text>
          )}
          {displayData.healthScore != null &&
            !isNaN(displayData.healthScore) && (
              <Text style={styles.metadataText}>
                💚 {Math.round(displayData.healthScore)}
                {t('recipes.percentHealthy')}
              </Text>
            )}
          {/* Cooked count - inline with metadata */}
          {!!isBackendRecipe && !!recipeId && !!isSaved && (
            <Pressable
              style={({ pressed }) => [
                styles.cookedMetadata,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setCookedModalVisible(true)}
              disabled={markingAsCooked}
            >
              {markingAsCooked ? (
                <SuccessActivityIndicator size="small" />
              ) : (
                <>
                  <Icon
                    name={
                      cookedCount > 0
                        ? 'checkmark-circle'
                        : 'checkmark-circle-outline'
                    }
                    size={14}
                    tone={cookedCount > 0 ? 'success' : 'textSecondary'}
                  />
                  <Text
                    style={[
                      styles.metadataText,
                      cookedCount > 0 && styles.metadataTextSuccess,
                    ]}
                  >
                    {cookedCount > 0
                      ? t('recipes.cookedCount', { count: cookedCount })
                      : t('recipes.markCooked')}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <RecipeEnrichment
          caloriesPerServing={displayData.caloriesPerServing}
          nutritionData={displayData.nutritionData}
          tips={displayData.tips}
          videoUrl={displayData.videoUrl}
          forkedFromName={displayData.forkedFromName}
          originalAuthor={displayData.originalAuthor}
          tags={displayData.tags}
          isBackendRecipe={isBackendRecipe}
          isPublished={displayData.isPublished}
        />

        {!!isBackendRecipe && !!recipeId && !!isSaved && (
          <SavedRecipeMetadataPanel
            savedFolder={savedFolder}
            savedTags={savedTags}
            savedNotes={savedNotes}
            savedRating={savedRating}
            updatingFolderTags={updatingFolderTags}
            onUpdateRating={handleUpdateRating}
          />
        )}

        {/* Dietary Tags */}
        {!isBackendRecipe && (
          <View style={styles.tags}>
            {!!displayData.vegetarian && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('recipes.vegetarian')}</Text>
              </View>
            )}
            {!!displayData.vegan && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('recipes.vegan')}</Text>
              </View>
            )}
            {!!displayData.glutenFree && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('recipes.glutenFree')}</Text>
              </View>
            )}
            {!!displayData.dairyFree && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('recipes.dairyFree')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        {!!displayData.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('recipes.about')}</Text>
            <Text style={styles.description}>
              {typeof displayData.summary === 'string'
                ? displayData.summary.replace(/<[^>]*>/g, '')
                : displayData.summary}
            </Text>
          </View>
        )}

        {/* Ingredients */}
        {!!displayData.ingredients && displayData.ingredients.length > 0 && (
          <View style={styles.ingredientsSection}>
            <View style={styles.ingredientsSectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('recipes.ingredients')}
              </Text>
              <Pressable
                onPress={handleAddAll}
                disabled={addingToList}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <Text style={styles.addAllButton}>
                  {addingToList ? t('recipes.adding') : t('recipes.addAll')}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ingredientsList}
            >
              {displayData.ingredients.map((ingredient, index) => (
                <React.Fragment key={`${ingredient.id}-${index}`}>
                  {index > 0 && <IngredientSeparator />}
                  <IngredientCard
                    ingredient={ingredient}
                    isAdded={addedIngredients.has(ingredient.id)}
                    onPress={() => handleAddSingleIngredient(ingredient)}
                  />
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        )}

        <RecipeInstructions
          isBackendRecipe={isBackendRecipe}
          instructions={displayData.instructions}
          instructionsHtml={displayData.instructionsHtml}
        />

        {/* Reviews Section */}
        {!!isBackendRecipe && !!recipeId && (
          <ReviewSection {...reviewState} {...reviewActions} />
        )}

        {/* Source Attribution */}
        {!!(displayData.sourceName || displayData.sourceUrl) && (
          <Pressable
            style={({ pressed }) => [
              styles.attribution,
              displayData.sourceUrl && pressed && { opacity: 0.7 },
            ]}
            onPress={() =>
              displayData.sourceUrl && Linking.openURL(displayData.sourceUrl)
            }
            disabled={!displayData.sourceUrl}
          >
            <Text style={styles.attributionText}>
              {t('recipes.recipeFrom', {
                source: displayData.sourceName || t('recipes.externalSource'),
              })}
            </Text>
            {!!displayData.sourceUrl && (
              <View style={styles.viewOriginalLink}>
                <Text style={styles.viewOriginalText}>
                  {t('recipes.viewOriginalRecipe')}
                </Text>
                <Icon name="open-outline" size={14} tone="primary" />
              </View>
            )}
          </Pressable>
        )}
      </CollapsingHeroDetail>

      <ShoppingListPickerSheet
        visible={listPickerVisible}
        shoppingLists={shoppingLists}
        defaultNewListName={displayData?.title ?? ''}
        creatingList={creatingList}
        onListSelected={handleListSelected}
        onCreateListAndAdd={handleCreateListAndAddIngredients}
        onDismiss={handleSheetDismiss}
        BottomSheetScrollable={BottomSheetScrollable}
      />

      {/* Mark Cooked Modal */}
      <MarkCookedModal
        visible={cookedModalVisible}
        recipeName={displayData.title || ''}
        defaultServings={displayData.servings || 1}
        onClose={() => setCookedModalVisible(false)}
        onConfirm={handleMarkAsCooked}
        hasPantry={ingredientMatching.hasPantry}
      />

      {/* Ingredient Matching Sheet */}
      <IngredientMatchingSheet
        visible={ingredientMatching.isSheetVisible}
        editableMatches={ingredientMatching.editableMatches}
        matchSummary={ingredientMatching.matchSummary}
        onUpdate={ingredientMatching.updateMatch}
        onConfirm={ingredientMatching.confirmConsumption}
        onSkip={handleSkipReview}
        onClose={ingredientMatching.closeSheet}
        confirmLoading={ingredientMatching.confirmLoading}
      />

      {/* Folder Picker Modal - for editing existing saved recipe folder */}
      <FolderPicker
        visible={showFolderPicker}
        folders={folders}
        selectedFolder={savedFolder}
        onSelect={handleUpdateFolder}
        onCancel={() => setShowFolderPicker(false)}
        loading={updatingFolderTags}
      />

      {/* Save Recipe Sheet - Bottom sheet for saving new recipe with folder, tags, and notes */}
      <SaveRecipeSheet
        visible={showSaveSheet}
        onClose={handleCloseSaveSheet}
        folders={folders}
        availableTags={availableTags}
        onSave={handleConfirmSave}
        saving={saving}
        recipeName={displayData?.title}
      />

      {/* Add to Meal Plan Sheet */}
      <AddToMealPlanSheet
        visible={showAddToMealPlanSheet}
        onClose={() => setShowAddToMealPlanSheet(false)}
        recipeId={recipeId ?? ''}
      />

      {/* Manage Recipe Sheet - Bottom sheet for managing saved recipes */}
      <ManageRecipeSheet
        visible={showManageSheet}
        onClose={handleCloseManageSheet}
        folders={folders}
        availableTags={availableTags}
        currentFolder={savedFolder}
        currentTags={savedTags}
        currentNotes={savedNotes}
        currentRating={savedRating}
        onUpdateFolder={handleUpdateFolder}
        onUpdateTags={handleUpdateTags}
        onUpdateNotes={handleUpdateNotes}
        onUpdateRating={handleUpdateRating}
        onRemove={handleUnfavoriteRecipe}
        updating={updatingFolderTags}
        recipeName={displayData?.title}
      />
    </>
  );
};

export const RecipeDetail: React.FC = () => (
  <RecipeDetailErrorBoundary>
    <RecipeDetailScreen />
  </RecipeDetailErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  recipeContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  titleSpacing: {
    marginBottom: theme.spacing.md,
  },
  metadata: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metadataText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  metadataTextSuccess: {
    color: theme.colors.success,
  },
  cookedMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tag: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  tagText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  ingredientsSection: {
    marginBottom: theme.spacing.xl,
    marginHorizontal: -theme.spacing.lg,
  },
  ingredientsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  addAllButton: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  ingredientsList: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  attribution: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xl,
  },
  attributionText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  viewOriginalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  viewOriginalText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
