import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import Animated from 'react-native-reanimated';
import { useMutation, useQuery } from '@apollo/client/react';
import { AddItemToShoppingListDocument } from '../../graphql/operations/shoppingList/shoppingList.generated';
import {
  GetPantryItemDocument,
  DeletePantryItemDocument,
} from '#operations/pantry/pantry.generated';
import {
  useSelectedShoppingListId,
  useSelectedPantryId,
} from '#store/useAppStore';
import { removeFromPantryItemsCache } from '#hooks/home/pantry/utils';
import { useRecipeSuggestionsStore } from '#store/useRecipeSuggestionsStore';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { resolveImageUrl, parseImages, hasImages } from '#utils/imageUtils';
import {
  formatPackageBreakdownFull,
  formatNetWeightDisplay,
  formatQuantityBreakdown,
  formatStorageState,
  getExpiryInfo,
  getDaysInPantry,
  formatDaysInPantry,
} from '#hooks/pantry/usePantryItemTransformation';
import { getUnitDisplayText } from '#utils/formatQuantity';
import { PantryDetailInfo } from '#components/pantry/PantryDetailInfo';
import { PantryUsageHistory } from '#components/pantry/PantryUsageHistory';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, type HeaderAction } from '#components/molecules/Header';
import { Icon } from '#/utils/iconUtils';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useConvertExpiredToWaste } from '#hooks/pantry/mutations/useConvertExpiredToWaste';
import { useConvertExpiredBatchesToWaste } from '#hooks/pantry/mutations/useConvertExpiredBatchesToWaste';
import { BatchSection } from '#components/pantry/BatchSection';
import { useAdjustPantryItemQuantity } from '#hooks/pantry/mutations/useAdjustPantryItemQuantity';
import { useCorrectPantryItemWeight } from '#hooks/pantry/mutations/useCorrectPantryItemWeight';
import { AdjustQuantityModal } from '#components/modals/AdjustQuantityModal';
import { CorrectWeightModal } from '#components/modals/CorrectWeightModal';
import { errorService } from '#/services/errorService';
import {
  executeWithLoadingState,
  executeMutation,
  executeRefreshWithFinally,
} from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { usePantryPermissions } from '#hooks/pantry/usePantryPermissions';

/** Module-level helper to sync suggested recipes from cache */
function syncSuggestedRecipesFromCache(
  cachedRecipes: RecipeInformation[],
  setSuggestedRecipes: (v: RecipeInformation[]) => void,
) {
  setSuggestedRecipes(cachedRecipes);
}

export const PantryItemDetail: React.FC<
  StaticScreenProps<{
    itemId: string;
  }>
> = ({ route }) => {
  useScreenTransition('PantryItemDetail');
  const itemId = route.params.itemId;
  const { goBack, navigateTo, navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();
  const { getCachedSuggestions, setCachedSuggestions } =
    useRecipeSuggestionsStore();

  const [addToListStatus, setAddToListStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [purchaseHistoryExpanded, setPurchaseHistoryExpanded] = useState(false);

  // Ref to track timeout for cleanup
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // Recipes to try state
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeInformation[]>(
    [],
  );
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId },
  });

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const [deleteItem] = useMutation(DeletePantryItemDocument, {
    update: (cache, { data: mutationData }, { variables }) => {
      if (
        !mutationData?.deletePantryItem?.pantryItem ||
        !selectedPantryId ||
        !variables
      ) {
        return;
      }
      removeFromPantryItemsCache(cache, selectedPantryId, variables.id, {
        evictItem: true,
      });
      cache.modify({
        id: cache.identify({ __typename: 'Pantry', id: selectedPantryId }),
        fields: {
          stats(existingStats: any) {
            if (!existingStats) return existingStats;
            return {
              ...existingStats,
              totalItems: Math.max(0, (existingStats.totalItems || 0) - 1),
            };
          },
        },
      });
    },
  });
  const [addToShoppingList] = useMutation(AddItemToShoppingListDocument, {
    update: (cache, { data: mutationData }) => {
      const shoppingListItem =
        mutationData?.addItemToShoppingList?.shoppingListItem;
      if (!shoppingListItem || !selectedShoppingListId) return;

      try {
        addNewItemToShoppingListCache(
          cache,
          selectedShoppingListId,
          shoppingListItem,
        );
      } catch (error) {
        console.warn('Cache update failed for addToShoppingList:', error);
      }
    },
  });

  // Adjust quantity modal state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  // Correct weight modal state
  const [correctWeightVisible, setCorrectWeightVisible] = useState(false);

  // Expired to waste mutation (item-level)
  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: () => {
      alertService.alert('Done', 'Expired item has been discarded.');
    },
  });

  // Expired batches to waste mutation (batch-level)
  const { convertExpiredBatches } = useConvertExpiredBatchesToWaste({
    onSuccess: () => {
      alertService.alert('Done', 'Expired batches have been discarded.');
    },
  });

  // Adjust quantity mutation
  const { adjustQuantity } = useAdjustPantryItemQuantity();

  // Correct weight mutation
  const { correctWeight } = useCorrectPantryItemWeight();

  const permissions = usePantryPermissions();

  const item = data?.pantryItem;

  // Fetch suggested recipes based on pantry item - use cache when available
  useEffect(() => {
    const itemName = item?.itemName;
    if (!itemName) return;

    // Check cache first
    const cachedRecipes = getCachedSuggestions(itemName);
    if (cachedRecipes) {
      syncSuggestedRecipesFromCache(cachedRecipes, setSuggestedRecipes);
      return;
    }

    const controller = new AbortController();

    // Cache miss - fetch from API
    executeWithLoadingState(
      async () => {
        const recipes = await spoonacularService.searchRecipes(
          {
            query: itemName,
            number: 5,
            addRecipeInformation: true,
          },
          controller.signal,
        );
        const results = recipes.results as unknown as RecipeInformation[];
        setSuggestedRecipes(results);
        setCachedSuggestions(itemName, results);
      },
      setLoadingRecipes,
      (error: unknown) => {
        if ((error as any)?.name === 'AbortError') return;
        errorService.reportError(error, {
          operation: 'PantryItemDetail.fetchSuggestedRecipes',
        });
      },
    );

    return () => controller.abort();
  }, [item?.itemName, getCachedSuggestions, setCachedSuggestions]);

  const handleDelete = () => {
    alertService.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            executeMutation(
              async () => {
                await deleteItem({
                  variables: { id: itemId },
                });
                goBack();
              },
              error => {
                errorService.reportError(error, {
                  operation: 'PantryItemDetail.deleteItem',
                });
                alertService.alert('Error', 'Failed to delete item');
              },
            );
          },
        },
      ],
    );
  };

  const handleAddToShoppingList = () => {
    if (!selectedShoppingListId) {
      alertService.alert(
        'No Shopping List Selected',
        'Please select a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Shopping Lists',
            onPress: () => navigateTo.shoppingListMain(),
          },
        ],
      );
      return;
    }

    if (addToListStatus === 'loading' || addToListStatus === 'success') {
      return;
    }

    setAddToListStatus('loading');

    // Pre-compute values outside the try-catch to avoid value block bailouts
    const catalogItemId = data?.pantryItem?.item?.id || '';
    const quantity = data?.pantryItem?.quantity || 1;
    const unitInput = data?.pantryItem?.unit?.id
      ? { unitId: data.pantryItem.unit.id }
      : undefined;
    const itemName = data?.pantryItem?.itemName || '';

    executeMutation(
      async () => {
        await addToShoppingList({
          variables: {
            input: {
              shoppingListId: selectedShoppingListId,
              itemId: catalogItemId,
              quantity,
              unit: unitInput,
              itemName,
            },
          },
        });
        setAddToListStatus('success');
        statusTimeoutRef.current = setTimeout(
          () => setAddToListStatus('idle'),
          3000,
        );
      },
      error => {
        errorService.reportError(error, {
          operation: 'PantryItemDetail.addToShoppingList',
        });
        setAddToListStatus('error');
        statusTimeoutRef.current = setTimeout(
          () => setAddToListStatus('idle'),
          3000,
        );
      },
    );
  };

  const handleEdit = () => {
    navigateTo.pantryItem({ itemId });
  };

  const handleRecipePress = (recipeId: number) => {
    // Navigate within Pantry stack - back navigation works automatically
    navigate('RecipeDetail', {
      externalSource: 'SPOONACULAR',
      externalId: String(recipeId),
    });
  };

  const handleDiscardExpired = () => {
    if (!item) return;

    const hasBatches = (item.activeBatchCount ?? 0) > 0;

    if (hasBatches) {
      alertService.alert(
        'Discard Expired Batches',
        'This will mark all expired batches as wasted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => convertExpiredBatches(item.id),
          },
        ],
      );
    } else {
      alertService.alert(
        'Discard Expired Item',
        `This will mark the remaining ${item.quantity} ${
          item.unit?.name || ''
        } as wasted due to expiration.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => convertExpiredToWaste(item.id),
          },
        ],
      );
    }
  };

  const handleConfirmAdjust = (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => {
    if (!item) return;
    adjustQuantity(
      item.id,
      newQuantity,
      reason,
      item.version ?? undefined,
      remainingNetWeight,
    );
  };

  const handleCorrectWeight = (
    netWeight: number,
    reason: string,
    netWeightUnitId?: string,
  ) => {
    if (!item) return;
    correctWeight(
      item.id,
      netWeight,
      reason,
      item.version ?? 0,
      netWeightUnitId,
    );
  };

  // Computed values
  const imageUrl = resolveImageUrl(item, 'large');
  const expiryInfo = getExpiryInfo(item?.expiresAt);
  const daysInPantry = getDaysInPantry(item?.createdAt);
  const storageStateDisplay = formatStorageState(item?.storageState);
  // Use pantryItem's specific brand (not item.brands which contains all brands for the item type)
  const brandName = item?.brand?.name || null;
  // Get category name for display
  const categoryName = item?.item?.categories?.[0]?.category?.name || null;
  // Images and nutrition from catalog item
  const itemImages = parseImages(item?.item?.images);
  const itemNutritions = parseNutritions(item?.item?.nutritions);
  const showImages = hasImages(itemImages) || !!imageUrl;
  const showNutrition = hasNutritionData(itemNutritions);
  const packageBreakdownText = formatPackageBreakdownFull(
    item?.packageBreakdown,
  );
  const netWeightText = formatNetWeightDisplay(
    item?.netWeight,
    item?.netWeightUnit,
  );
  const remainingNetWeightText = formatNetWeightDisplay(
    item?.remainingNetWeight,
    item?.netWeightUnit,
  );
  const quantityBreakdownText = formatQuantityBreakdown(
    item?.quantityBreakdown,
  );

  if (!item) {
    return (
      <View style={styles.container}>
        <Header variant="detail" onBack={goBack} borderless />
        <View style={styles.loadingContainer}>
          <SousChefLoader size="small" showBrand={false} message="Loading" />
        </View>
      </View>
    );
  }

  const hasExpiredBatches =
    (item.condition === 'EXPIRED' && item.quantity > 0) ||
    item.batches?.some(
      b =>
        b.status === 'ACTIVE' &&
        b.expiresAt &&
        new Date(b.expiresAt) < new Date(),
    );

  const discardActions: HeaderAction[] =
    hasExpiredBatches && permissions.canEditItems
      ? [
          {
            icon: 'close-circle-outline',
            onPress: handleDiscardExpired,
            variant: 'error',
            testID: 'pantry-item-discard-button',
          },
        ]
      : [];

  const headerActions: HeaderAction[] = [
    ...(permissions.canAddItems
      ? [
          {
            icon: addToListStatus === 'success' ? 'cart' : 'cart-outline',
            onPress: handleAddToShoppingList,
            variant: addToListStatus === 'success' ? 'success' : 'primary',
            loading: addToListStatus === 'loading',
            testID: 'pantry-item-add-to-list-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...discardActions,
    ...(permissions.canEditItems
      ? ([
          {
            icon: 'swap-vertical-outline',
            onPress: () => setAdjustModalVisible(true),
            testID: 'pantry-item-adjust-button',
          },
          {
            icon: 'create-outline',
            onPress: handleEdit,
            testID: 'pantry-item-edit-button',
          },
          {
            icon: 'trash-outline',
            onPress: handleDelete,
            variant: 'error',
            testID: 'pantry-item-delete-button',
          },
        ] satisfies HeaderAction[])
      : []),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        variant="detail"
        onBack={goBack}
        borderless
        rightActions={headerActions}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Image Gallery - show if images or fallback URL exists */}
        {!!showImages && (
          <View style={styles.imageSection}>
            <ImageGalleryTabs
              images={itemImages}
              fallbackImageUrl={imageUrl}
              imageHeight={200}
            />
          </View>
        )}

        {/* Title Row - Name */}
        <View style={styles.titleRow}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.itemName}
          </Text>
        </View>

        {/* Category Badge with Storage Location */}
        {!!(categoryName || storageStateDisplay) && (
          <View style={styles.categoryBadge}>
            <Icon
              name="restaurant-outline"
              size={16}
              color={theme.colors.primary}
            />
            <Text style={styles.categoryText}>
              {categoryName || 'Item'}
              {storageStateDisplay ? ` in ${storageStateDisplay}` : ''}
            </Text>
          </View>
        )}

        {/* Three-Column Info Row */}
        <View style={styles.infoColumns}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>In the pantry</Text>
            <Text style={styles.infoColumnValue}>
              {formatDaysInPantry(daysInPantry)}
            </Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>Expiring</Text>
            <Text
              style={[
                styles.infoColumnValue,
                expiryInfo?.isUrgent && styles.expiryColumnUrgent,
                expiryInfo?.isExpired && styles.expiryColumnExpired,
              ]}
            >
              {expiryInfo?.text || 'No expiry'}
            </Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>Amount</Text>
            <Text style={styles.infoColumnValue}>
              {item.quantity} {getUnitDisplayText(item.unit)}
            </Text>
          </View>
        </View>

        {/* Nutrition Summary - navigates to NutritionScreen */}
        {!!showNutrition && (
          <View style={styles.nutritionSection}>
            <Text style={styles.nutritionTitle}>Nutrition</Text>
            <NutritionSummary
              nutritions={itemNutritions}
              showHighlights
              onPress={() =>
                navigateTo.nutritionScreen({
                  itemId: item.id,
                  itemName: item.itemName,
                  nutritions: item.item?.nutritions,
                })
              }
            />
          </View>
        )}

        {/* Detail Info Rows */}
        <PantryDetailInfo
          item={item}
          brandName={brandName}
          netWeightText={netWeightText}
          remainingNetWeightText={remainingNetWeightText}
          quantityBreakdownText={quantityBreakdownText}
          packageBreakdownText={packageBreakdownText}
          shelfLifeDays={item.item?.shelfLifeDays}
          shelfLifeOpenedDays={item.item?.shelfLifeOpenedDays}
          onCorrectWeight={() => setCorrectWeightVisible(true)}
        />

        {/* Batch Section - only show when item has been restocked (2+ batches) */}
        {!!item.batches && item.batches.length > 1 && (
          <BatchSection
            batches={item.batches}
            pantryItemId={item.id}
            unitSymbol={item.unit?.symbol ?? undefined}
          />
        )}

        {/* Usage Records Section */}
        {!!item.usageRecords && item.usageRecords.edges.length > 0 && (
          <PantryUsageHistory
            usageRecords={item.usageRecords.edges}
            expanded={purchaseHistoryExpanded}
            onToggle={() =>
              setPurchaseHistoryExpanded(!purchaseHistoryExpanded)
            }
          />
        )}

        {/* Recipes to try */}
        <View style={styles.recipesSection}>
          <Text style={styles.sectionTitle}>Recipes to try</Text>
          {loadingRecipes ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={styles.recipesLoading}
            />
          ) : suggestedRecipes.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipesList}
            >
              {suggestedRecipes.map(recipe => (
                <Pressable
                  key={String(recipe.id)}
                  style={({ pressed }) => [
                    styles.recipeCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleRecipePress(recipe.id)}
                >
                  <Animated.Image
                    source={{ uri: recipe.image }}
                    style={styles.recipeImage}
                    resizeMode="cover"
                    sharedTransitionTag={`recipe-image-${recipe.id}`}
                  />
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noRecipes}>
              No recipe suggestions available
            </Text>
          )}
        </View>

        {/* Bottom padding for safe area */}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {!!adjustModalVisible && (
        <AdjustQuantityModal
          visible={adjustModalVisible}
          pantryItem={item}
          onClose={() => setAdjustModalVisible(false)}
          onConfirm={handleConfirmAdjust}
        />
      )}

      {!!correctWeightVisible && (
        <CorrectWeightModal
          visible={correctWeightVisible}
          pantryItem={item}
          onClose={() => setCorrectWeightVisible(false)}
          onConfirm={handleCorrectWeight}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageSection: {
    marginBottom: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  itemTitle: {
    flex: 1,
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.md,
  },
  quantityBadge: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  categoryText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  infoColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  infoColumn: {
    alignItems: 'center',
    flex: 1,
  },
  infoColumnLabel: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoColumnValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  expiryColumnUrgent: {
    color: theme.colors.warning,
  },
  expiryColumnExpired: {
    color: theme.colors.error,
  },
  nutritionSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  nutritionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  recipesSection: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  recipesLoading: {
    marginTop: theme.spacing.md,
  },
  recipesList: {
    paddingTop: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  recipeCard: {
    width: 140,
    marginRight: theme.spacing.md,
  },
  recipeImage: {
    width: 140,
    height: 100,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  recipeTitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fonts.weight.medium,
  },
  noRecipes: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
