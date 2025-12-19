import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BottomSheetAction } from '#components';
import { RecipeDetailErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { MarkCookedModal } from '#/components/modals/MarkCookedModal';
import { useRecipeDetail } from './useRecipeDetail';
import { IngredientCard } from './components';

const RecipeDetailScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const {
    goBack,
    recipeId,
    loading,
    error,
    backendError,
    displayData,
    isBackendRecipe,
    backendRecipe,
    saving,
    recipeSaved,
    handleSaveRecipe,
    addingToList,
    addedIngredients,
    selectedIngredients,
    handleAddSingleIngredient,
    handleAddAllIngredientsToList,
    handleAddAllIngredients,
    handleAddSelectedIngredients,
    toggleIngredient,
    openIngredientSelector,
    shoppingListOptionsRef,
    ingredientSelectorRef,
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
  } = useRecipeDetail();

  // Scroll animation for parallax effect
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 300],
      [1, 0.95],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading recipe...</Text>
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
        {backendError && (
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
        {displayData.image && (
          <View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: displayData.image }}
              style={[styles.recipeImage, imageAnimatedStyle]}
            />
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1d1d1d" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveRecipe}
              style={styles.favoriteButton}
              disabled={saving || recipeSaved || isBackendRecipe}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#E91E63" />
              ) : (
                <Ionicons
                  name={
                    recipeSaved || isBackendRecipe ? 'heart' : 'heart-outline'
                  }
                  size={24}
                  color="#E91E63"
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{displayData.title}</Text>

          {/* Recipe Metadata */}
          <View style={styles.metadata}>
            {displayData.servings != null && (
              <Text style={styles.metadataText}>
                🍽️ {displayData.servings} servings
              </Text>
            )}
            {displayData.readyInMinutes != null && (
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
          </View>

          {/* I Cooked This Button */}
          {isBackendRecipe && recipeId && (
            <TouchableOpacity
              style={styles.cookedButton}
              onPress={() => setCookedModalVisible(true)}
              disabled={markingAsCooked}
            >
              {markingAsCooked ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.cookedButtonText}>I Cooked This!</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Dietary Tags */}
          {!isBackendRecipe && (
            <View style={styles.tags}>
              {displayData.vegetarian && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegetarian</Text>
                </View>
              )}
              {displayData.vegan && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegan</Text>
                </View>
              )}
              {displayData.glutenFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Gluten Free</Text>
                </View>
              )}
              {displayData.dairyFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Dairy Free</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {displayData.summary && (
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
          {displayData.ingredients && displayData.ingredients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <TouchableOpacity
                  onPress={handleAddAllIngredientsToList}
                  disabled={addingToList}
                >
                  <Text style={styles.addAllButton}>
                    {addingToList ? 'Adding...' : 'Add All'}
                  </Text>
                </TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={displayData.ingredients}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ingredientsList}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item: ingredient }) => (
                  <IngredientCard
                    ingredient={ingredient}
                    isAdded={addedIngredients.has(ingredient.id)}
                    onPress={() => handleAddSingleIngredient(ingredient)}
                  />
                )}
              />
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
                <Text style={styles.sectionTitle}>Recipe</Text>
                {hasBackendInstructions &&
                  displayData.instructions.map((step: any, index: number) => (
                    <View key={index} style={styles.instructionStep}>
                      <Text style={styles.stepNumber}>
                        {step.number || index + 1}.
                      </Text>
                      <Text style={styles.stepText}>{step.step}</Text>
                    </View>
                  ))}
                {hasAnalyzedInstructions &&
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
                  hasHtmlInstructions && (
                    <Text style={styles.description}>
                      {displayData.instructionsHtml
                        ?.replace(/<[^>]*>/g, '\n')
                        .trim()}
                    </Text>
                  )}
              </View>
            );
          })()}

          {/* Source Attribution */}
          {(displayData.sourceName || displayData.sourceUrl) && (
            <TouchableOpacity
              style={styles.attribution}
              onPress={() =>
                displayData.sourceUrl && Linking.openURL(displayData.sourceUrl)
              }
              disabled={!displayData.sourceUrl}
              activeOpacity={displayData.sourceUrl ? 0.7 : 1}
            >
              <Text style={styles.attributionText}>
                Recipe from {displayData.sourceName || 'External Source'}
              </Text>
              {displayData.sourceUrl && (
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
            </TouchableOpacity>
          )}
        </View>
      </Animated.ScrollView>

      {/* Shopping List Options Bottom Sheet */}
      <BottomSheetAction
        sheetRef={shoppingListOptionsRef}
        sheetTitle="Add to Shopping List"
        snapPoints={['30%']}
      >
        <View style={styles.shoppingListOptions}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
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
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionButton}
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
          </TouchableOpacity>
        </View>
      </BottomSheetAction>

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSelectorRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
      >
        <FlatList
          data={backendRecipe?.ingredients || []}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => {
            const isSelected = selectedIngredients.has(item.id);
            return (
              <TouchableOpacity
                style={styles.ingredientItem}
                onPress={() => toggleIngredient(item.id)}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientAmount}>
                    {item.quantity ?? ''} {item.unit?.symbol || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No ingredients available</Text>
          }
        />
        <TouchableOpacity
          style={[
            styles.addSelectedButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleAddSelectedIngredients}
          disabled={selectedIngredients.size === 0 || addingToList}
        >
          {addingToList ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addSelectedButtonText}>
              Add {selectedIngredients.size} ingredient
              {selectedIngredients.size !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </BottomSheetAction>

      {/* Mark Cooked Modal */}
      <MarkCookedModal
        visible={cookedModalVisible}
        recipeName={displayData.title || ''}
        defaultServings={displayData.servings || 1}
        onClose={() => setCookedModalVisible(false)}
        onConfirm={handleMarkAsCooked}
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
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
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
    resizeMode: 'cover',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  favoriteButton: {
    position: 'absolute',
    top: 48,
    right: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
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
    fontWeight: '700',
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
  cookedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.full,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  cookedButtonText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: '#FFFFFF',
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
    fontWeight: '600',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  addAllButton: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  ingredientsList: {
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
}));
