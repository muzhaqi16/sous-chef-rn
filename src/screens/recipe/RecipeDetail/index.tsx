import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import TurboImage from 'react-native-turbo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BackButton } from '#components/atoms/BackButton';

import {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { RecipeDetailErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { MarkCookedModal } from '#/components/modals/MarkCookedModal';
import { IngredientMatchingSheet } from '#/components/modals/IngredientMatchingSheet';
import { SaveRecipeSheet } from '#/components/modals/SaveRecipeSheet/SaveRecipeSheet';
import { ManageRecipeSheet } from '#/components/modals/ManageRecipeSheet/ManageRecipeSheet';
import { AddToMealPlanSheet } from '#components/mealPlan/AddToMealPlanSheet';
import { useRecipeFolders } from '#/hooks/recipe/useRecipeFolders';
import { useRecipeTags } from '#/hooks/recipe/useRecipeTags';
import { useRecipeReviews } from '#/hooks/recipe/useRecipeReviews';
import { ReviewSection } from '#/components/recipe/ReviewSection';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useRecipeDetail } from './useRecipeDetail';
import { IngredientCard } from './components/IngredientCard';
import {
  SelectableIngredientProvider,
  useSelectableIngredients,
} from './SelectableIngredientContext';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAuthUser } from '#hooks/auth/useAuthUser';
import { SousChefLoader } from '#/components/base/SousChefLoader';

const AnimatedTurboImage = Animated.createAnimatedComponent(TurboImage);

const IngredientSeparator = () => <View style={{ width: 12 }} />;

// --- Module-scope FlashList infrastructure for selectable ingredients ---

interface SelectableIngredientItemProps {
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: { symbol: string } | null;
  };
}

// Module-scope keyExtractor — zero runtime overhead
const ingredientKeyExtractor = (item: { id: string }) => item.id;

// Bridge component — reads selection state from context, receives theme colors via props
const SelectableIngredientItemComponent: React.FC<
  ListRenderItemInfo<SelectableIngredientItemProps['item']> & {
    primaryColor: string;
    textSecondary: string;
  }
> = ({ item, primaryColor, textSecondary }) => {
  const { selectedIngredients, toggleIngredient } = useSelectableIngredients();
  const isSelected = selectedIngredients.has(item.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.ingredientItem,
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => toggleIngredient(item.id)}
    >
      <Ionicons
        name={isSelected ? 'checkbox' : 'square-outline'}
        size={24}
        color={isSelected ? primaryColor : textSecondary}
      />
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{item.name}</Text>
        <Text style={styles.ingredientAmount}>
          {item.quantity ?? ''} {item.unit?.symbol || ''}
        </Text>
      </View>
    </Pressable>
  );
};

const SelectableIngredientItem = SelectableIngredientItemComponent;

const getSelectableIngredientItemType = () => 'item';

// --- End module-scope FlashList infrastructure ---

const RecipeDetailScreen: React.FC = () => {
  useScreenTransition('RecipeDetail');
  const { theme } = useUnistyles();

  const { navigate } = useAppNavigation();
  const user = useAuthUser();
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
    selectedIngredients,
    handleAddSingleIngredient,
    handleAddAllIngredientsToList,
    handleAddAllIngredients,
    handleAddSelectedIngredients,
    handleListSelected,
    toggleIngredient,
    openIngredientSelector,
    creatingList,
    handleCreateListAndAddIngredients,
    shoppingListOptionsRef,
    ingredientSelectorRef,
    listPickerRef,
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
      navigate('RecipeEdit', { recipeId });
    }
  };

  // State for save/manage recipe sheets
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [showAddToMealPlanSheet, setShowAddToMealPlanSheet] = useState(false);

  // State for inline "Create New List" in list picker
  const [newListName, setNewListName] = useState(displayData?.title ?? '');

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

  const renderShoppingListItem = ({
    item,
  }: {
    item: (typeof shoppingLists)[number];
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.listPickerItem,
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => handleListSelected(item.id)}
    >
      <View style={styles.listPickerInfo}>
        <Text style={styles.listPickerName}>{item.name}</Text>
        <Text style={styles.listPickerCount}>{item.totalItems ?? 0} items</Text>
      </View>
      {!!item.isDefault && (
        <View
          style={[
            styles.defaultBadge,
            { backgroundColor: theme.colors.primary + '20' },
          ]}
        >
          <Text
            style={[styles.defaultBadgeText, { color: theme.colors.primary }]}
          >
            Default
          </Text>
        </View>
      )}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );

  // Scroll animation for parallax effect
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.set(event.contentOffset.y);
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.get(),
      [0, 300],
      [1, 0.95],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <SousChefLoader
          size="small"
          showBrand={false}
          message="Loading recipe..."
        />
      </View>
    );
  }

  if (error || backendError || !displayData) {
    const errorMessage =
      error ||
      backendError?.message ||
      (recipeId && !backendRecipe
        ? 'Recipe not found in database'
        : 'Recipe not found');

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        {!!backendError && (
          <Text style={styles.errorDetails}>
            {JSON.stringify(backendError, null, 2)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Recipe Image with Back Button and Favorite Button */}
        {!!displayData.image && (
          <View style={styles.imageContainer}>
            <AnimatedTurboImage
              source={{ uri: displayData.image }}
              cachePolicy="dataCache"
              resizeMode="cover"
              style={[styles.recipeImage, imageAnimatedStyle]}
              sharedTransitionTag={
                externalId ? `recipe-image-${externalId}` : undefined
              }
            />
            <BackButton
              onPress={goBack}
              color={theme.colors.textPrimary}
              style={styles.backButton}
            />
            {/* Right side buttons container */}
            <View style={styles.rightButtons}>
              {/* Meal plan button - shown when recipe exists in backend */}
              {!!recipeId && (
                <Pressable
                  onPress={() => setShowAddToMealPlanSheet(true)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel="Add to meal plan"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {/* Edit button - shown when user is recipe creator */}
              {!!isOwner && (
                <Pressable
                  onPress={handleEditRecipe}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {/* Folder button - shown when not saved or saved to non-Favorites folder */}
              {!!showFolderIcon && (
                <Pressable
                  onPress={handleFolderPress}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  disabled={saving || updatingFolderTags}
                >
                  <Ionicons
                    name={isInOtherFolder ? 'folder' : 'folder-outline'}
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {/* Heart button - shown when not saved or saved to Favorites */}
              {!!showHeartIcon && (
                <Pressable
                  onPress={handleHeartPress}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  disabled={saving || updatingFolderTags}
                >
                  {saving || updatingFolderTags ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.favorite}
                    />
                  ) : (
                    <Ionicons
                      name={isInFavorites ? 'heart' : 'heart-outline'}
                      size={24}
                      color={theme.colors.favorite}
                    />
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}
        {!displayData.image && (
          <View
            style={[styles.noImageHeader, { paddingTop: theme.spacing.sm }]}
          >
            <BackButton onPress={goBack} />
            <View style={styles.noImageRightButtons}>
              {!!recipeId && (
                <Pressable
                  onPress={() => setShowAddToMealPlanSheet(true)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel="Add to meal plan"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {!!isOwner && (
                <Pressable
                  onPress={handleEditRecipe}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {!!showFolderIcon && (
                <Pressable
                  onPress={handleFolderPress}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  disabled={saving || updatingFolderTags}
                >
                  <Ionicons
                    name={isInOtherFolder ? 'folder' : 'folder-outline'}
                    size={22}
                    color={theme.colors.primary}
                  />
                </Pressable>
              )}
              {!!showHeartIcon && (
                <Pressable
                  onPress={handleHeartPress}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  disabled={saving || updatingFolderTags}
                >
                  {saving || updatingFolderTags ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.favorite}
                    />
                  ) : (
                    <Ionicons
                      name={isInFavorites ? 'heart' : 'heart-outline'}
                      size={24}
                      color={theme.colors.favorite}
                    />
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View style={[styles.content, !displayData.image && { marginTop: 0 }]}>
          <Text style={styles.title}>{displayData.title}</Text>

          {/* Recipe Metadata */}
          <View style={styles.metadata}>
            {displayData.servings != null && (
              <Text style={styles.metadataText}>
                🍽️ {displayData.servings} servings
              </Text>
            )}
            {!!displayData.readyInMinutes && (
              <Text style={styles.metadataText}>
                ⏱️ {displayData.readyInMinutes} min
              </Text>
            )}
            {displayData.healthScore != null &&
              !isNaN(displayData.healthScore) && (
                <Text style={styles.metadataText}>
                  💚 {Math.round(displayData.healthScore)}% healthy
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
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.success}
                  />
                ) : (
                  <>
                    <Ionicons
                      name={
                        cookedCount > 0
                          ? 'checkmark-circle'
                          : 'checkmark-circle-outline'
                      }
                      size={14}
                      color={
                        cookedCount > 0
                          ? theme.colors.success
                          : theme.colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.metadataText,
                        cookedCount > 0 && { color: theme.colors.success },
                      ]}
                    >
                      {cookedCount > 0
                        ? `Cooked ${cookedCount}x`
                        : 'Mark cooked'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Folder, Tags, Notes, Rating Section - Only for saved recipes */}
          {!!isBackendRecipe && !!recipeId && !!isSaved && (
            <View style={styles.folderTagsSection}>
              {/* Rating - interactive */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rating</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Pressable
                      key={star}
                      onPress={() =>
                        handleUpdateRating(star === savedRating ? null : star)
                      }
                      hitSlop={4}
                      disabled={updatingFolderTags}
                    >
                      <Ionicons
                        name={
                          savedRating !== null && star <= savedRating
                            ? 'star'
                            : 'star-outline'
                        }
                        size={18}
                        color={
                          savedRating !== null && star <= savedRating
                            ? theme.colors.rating
                            : theme.colors.textSecondary
                        }
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Folder - read-only display */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Folder</Text>
                <View style={styles.detailValue}>
                  <Ionicons
                    name="folder"
                    size={theme.fonts.size.sm}
                    color={
                      savedFolder
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.detailValueText,
                      savedFolder && { color: theme.colors.primary },
                    ]}
                  >
                    {savedFolder || 'None'}
                  </Text>
                </View>
              </View>

              {/* Tags - read-only display */}
              {savedTags.length > 0 && (
                <View style={styles.tagsDisplayRow}>
                  <Text style={styles.detailLabel}>Tags</Text>
                  <View style={styles.tagsChipsContainer}>
                    {savedTags.map((tag, index) => (
                      <View key={`${tag}-${index}`} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {!!savedNotes && (
                <View style={styles.notesDisplayRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.notesText}>{savedNotes}</Text>
                </View>
              )}
            </View>
          )}

          {/* Dietary Tags */}
          {!isBackendRecipe && (
            <View style={styles.tags}>
              {!!displayData.vegetarian && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegetarian</Text>
                </View>
              )}
              {!!displayData.vegan && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegan</Text>
                </View>
              )}
              {!!displayData.glutenFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Gluten Free</Text>
                </View>
              )}
              {!!displayData.dairyFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Dairy Free</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {!!displayData.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
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
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <Pressable
                  onPress={handleAddAllIngredientsToList}
                  disabled={addingToList}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  <Text style={styles.addAllButton}>
                    {addingToList ? 'Adding...' : 'Add All'}
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

          {/* Instructions */}
          {(() => {
            const hasBackendInstructions =
              isBackendRecipe &&
              Array.isArray(displayData.instructions) &&
              displayData.instructions.length > 0;
            const hasAnalyzedInstructions =
              !isBackendRecipe &&
              Array.isArray(displayData.instructions) &&
              displayData.instructions.length > 0 &&
              displayData.instructions[0]?.steps?.length > 0;
            const hasHtmlInstructions =
              !isBackendRecipe &&
              displayData.instructionsHtml &&
              typeof displayData.instructionsHtml === 'string';

            if (
              !hasBackendInstructions &&
              !hasAnalyzedInstructions &&
              !hasHtmlInstructions
            ) {
              return null;
            }

            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                {!!hasBackendInstructions &&
                  displayData.instructions.map((step: any, index: number) => {
                    // Support both formats:
                    // User-created: { step: number, text: string }
                    // Preloaded external: { number: number, step: string }
                    const stepText = step.text ?? step.step;
                    const stepNum =
                      step.text != null
                        ? step.step ?? index + 1
                        : step.number ?? index + 1;
                    return (
                      <View key={index} style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>{stepNum}.</Text>
                        <Text style={styles.stepText}>{stepText}</Text>
                      </View>
                    );
                  })}
                {!!hasAnalyzedInstructions &&
                  displayData.instructions[0].steps.map(
                    (step: any, index: number) => (
                      <View key={index} style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>{step.number}.</Text>
                        <Text style={styles.stepText}>{step.step}</Text>
                      </View>
                    ),
                  )}
                {!hasBackendInstructions &&
                  !hasAnalyzedInstructions &&
                  !!hasHtmlInstructions &&
                  (() => {
                    const steps = displayData
                      .instructionsHtml!.replace(/<li[^>]*>/gi, '\n<STEP>')
                      .replace(/<\/li>/gi, '')
                      .replace(/<[^>]*>/g, '\n')
                      .split('\n')
                      .map(s => s.replace('<STEP>', '').trim())
                      .filter(s => s.length > 0);

                    return steps.map((step, index) => (
                      <View key={index} style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>{index + 1}.</Text>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ));
                  })()}
              </View>
            );
          })()}

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
                Recipe from {displayData.sourceName || 'External Source'}
              </Text>
              {!!displayData.sourceUrl && (
                <View style={styles.viewOriginalLink}>
                  <Text style={styles.viewOriginalText}>
                    View Original Recipe
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={theme.colors.primary}
                  />
                </View>
              )}
            </Pressable>
          )}
        </View>
      </Animated.ScrollView>

      {/* Shopping List Options Bottom Sheet */}
      <BottomSheetAction
        sheetRef={shoppingListOptionsRef}
        sheetTitle="Add to Shopping List"
        snapPoints={['30%']}
        onDismiss={handleSheetDismiss}
      >
        <View style={styles.shoppingListOptions}>
          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleAddAllIngredients}
          >
            <Ionicons name="list" size={24} color={theme.colors.primary} />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Add All Ingredients</Text>
              <Text style={styles.optionDescription}>
                Add all recipe ingredients to your shopping list
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={openIngredientSelector}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Select Ingredients</Text>
              <Text style={styles.optionDescription}>
                Choose specific ingredients to add
              </Text>
            </View>
          </Pressable>
        </View>
      </BottomSheetAction>

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSelectorRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
        onDismiss={handleSheetDismiss}
      >
        <SelectableIngredientProvider
          selectedIngredients={selectedIngredients}
          toggleIngredient={toggleIngredient}
        >
          <FlashList
            data={backendRecipe?.ingredients || []}
            keyExtractor={ingredientKeyExtractor}
            renderItem={(
              info: ListRenderItemInfo<SelectableIngredientItemProps['item']>,
            ) => (
              <SelectableIngredientItem
                {...info}
                primaryColor={theme.colors.primary}
                textSecondary={theme.colors.textSecondary}
              />
            )}
            getItemType={getSelectableIngredientItemType}
            extraData={selectedIngredients.size}
            {...FLASHLIST_DEFAULTS.fullScreen}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No ingredients available</Text>
            }
          />
        </SelectableIngredientProvider>
        <Pressable
          style={({ pressed }) => [
            styles.addSelectedButton,
            { backgroundColor: theme.colors.primary },
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleAddSelectedIngredients}
          disabled={selectedIngredients.size === 0 || addingToList}
        >
          {addingToList ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={styles.addSelectedButtonText}>
              Add {selectedIngredients.size} ingredient
              {selectedIngredients.size !== 1 ? 's' : ''}
            </Text>
          )}
        </Pressable>
      </BottomSheetAction>

      {/* Shopping List Picker Bottom Sheet */}
      <BottomSheetAction
        sheetRef={listPickerRef}
        sheetTitle="Add to Shopping List"
        snapPoints={['60%']}
        scrollable={false}
        onDismiss={() => {
          setNewListName(displayData?.title ?? '');
          handleSheetDismiss();
        }}
      >
        <BottomSheetFlatList
          data={shoppingLists}
          keyExtractor={(item: (typeof shoppingLists)[number]) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing['2xl'],
          }}
          renderItem={renderShoppingListItem}
          ListFooterComponent={
            <View style={styles.createListFooter}>
              <View style={styles.createListInputRow}>
                <BottomSheetTextInput
                  style={[
                    styles.createListInput,
                    {
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  value={newListName}
                  onChangeText={setNewListName}
                  placeholder="New list name"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="words"
                  maxLength={100}
                />
                {!!newListName && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearNameButton,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => setNewListName('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.createListButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && { opacity: 0.7 },
                  !newListName.trim() && { opacity: 0.5 },
                ]}
                onPress={() => handleCreateListAndAddIngredients(newListName)}
                disabled={!newListName.trim() || creatingList}
              >
                {creatingList ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text style={styles.createListButtonText}>
                    Create & Add Ingredients
                  </Text>
                )}
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyListPicker}>
              <Text style={styles.emptyText}>No existing lists</Text>
            </View>
          }
        />
      </BottomSheetAction>

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
    </View>
  );
};

export const RecipeDetail: React.FC = () => (
  <RecipeDetailErrorBoundary>
    <RecipeDetailScreen />
  </RecipeDetailErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontFamily: 'monospace',
    textAlign: 'left',
  },
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 300,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2.22,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.22)',
      },
    ],
  },
  rightButtons: {
    position: 'absolute',
    top: 48,
    right: 12,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2.22,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.22)',
      },
    ],
  },
  noImageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  noImageRightButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    marginTop: -20,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
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
  cookedMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  folderTagsSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  detailValueText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tagsDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  tagsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  tagChip: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  tagChipText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  notesDisplayRow: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  notesText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
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
  instructionStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
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
  shoppingListOptions: {
    padding: theme.spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  ingredientAmount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  addSelectedButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  addSelectedButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  // List picker styles
  listPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  listPickerInfo: {
    flex: 1,
  },
  listPickerName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  listPickerCount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  defaultBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
  emptyListPicker: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptySubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  createListFooter: {
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  createListInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  createListInput: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  clearNameButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  createListButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  createListButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
