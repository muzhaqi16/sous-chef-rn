import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  useGetPantryItemQuery,
  useDeletePantryItemMutation,
  useAddItemToShoppingListMutation,
  StorageState,
  UsagePurpose,
} from '#generated';
import { useAppStore, selectSelectedShoppingListId } from '#store/useAppStore';
import { useRecipeSuggestionsStore } from '#store/useRecipeSuggestionsStore';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { resolveImageUrl, parseImages, hasImages } from '#utils/imageUtils';
import { formatPackageBreakdownFull, formatNetWeightDisplay, formatQuantityBreakdown } from '#hooks/pantry/usePantryItemTransformation';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '#components/molecules/Header';
import { Icon } from '#/utils/iconUtils';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useConvertExpiredToWaste } from '#hooks/pantry/mutations/useConvertExpiredToWaste';
import { useAdjustPantryItemQuantity } from '#hooks/pantry/mutations/useAdjustPantryItemQuantity';
import { useCorrectPantryItemWeight } from '#hooks/pantry/mutations/useCorrectPantryItemWeight';
import { AdjustQuantityModal } from '#components/modals/AdjustQuantityModal';
import { CorrectWeightModal } from '#components/modals/CorrectWeightModal';

// Helper function to calculate expiry info
const getExpiryInfo = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return { text: 'Expired', isExpired: true, isUrgent: true };
  if (diffDays === 0)
    return { text: 'Expires today', isExpired: false, isUrgent: true };
  if (diffDays === 1)
    return { text: '1 day to expire', isExpired: false, isUrgent: true };
  return {
    text: `${diffDays} days to expire`,
    isExpired: false,
    isUrgent: diffDays <= 3,
  };
};

// Format date
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Calculate days in pantry
const getDaysInPantry = (createdAt: string | null | undefined) => {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
};

// Format storage state for display
const formatStorageState = (state?: string | null): string => {
  if (!state) return '';
  const mapping: Record<string, string> = {
    [StorageState.Refrigerated]: 'Fridge',
    [StorageState.Frozen]: 'Freezer',
    [StorageState.Ambient]: 'Dry Pantry',
  };
  return mapping[state] || state;
};

// Format condition enum for display
const formatCondition = (condition?: string | null): string | null => {
  if (!condition || condition === 'GOOD') return null;
  return condition.charAt(0) + condition.slice(1).toLowerCase();
};

// Format acquisition method enum for display
const formatAcquisitionMethod = (method?: string | null): string | null => {
  if (!method) return null;
  return method
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

// Format currency
const formatCurrency = (amount?: number | null): string | null => {
  if (amount == null || amount <= 0) return null;
  return `$${amount.toFixed(2)}`;
};

export const PantryItemDetail: React.FC<StaticScreenProps<{
  itemId: string;
}>> = ({ route }) => {
  useScreenTransition('PantryItemDetail');
  const itemId = route.params.itemId;
  const { goBack, navigateTo, navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const selectedShoppingListId = useAppStore(selectSelectedShoppingListId);
  const { getCachedSuggestions, setCachedSuggestions } = useRecipeSuggestionsStore();

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

  const { data } = useGetPantryItemQuery({
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteItem] = useDeletePantryItemMutation();
  const [addToShoppingList] = useAddItemToShoppingListMutation({
    update: (cache, { data: mutationData }) => {
      if (!mutationData?.addItemToShoppingList || !selectedShoppingListId)
        return;

      try {
        const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
          'ShoppingList',
          'itemsConnection',
          'ShoppingListItem',
        );
        addToShoppingListItemsCache(
          cache,
          selectedShoppingListId,
          mutationData.addItemToShoppingList,
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

  // Expired to waste mutation
  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: () => {
      Alert.alert('Done', 'Expired item has been discarded.');
    },
  });

  // Adjust quantity mutation
  const { adjustQuantity } = useAdjustPantryItemQuantity();

  // Correct weight mutation
  const { correctWeight } = useCorrectPantryItemWeight();

  const item = data?.pantryItem;

  // Fetch suggested recipes based on pantry item - use cache when available
  useEffect(() => {
    const itemName = item?.itemName;
    if (!itemName) return;

    // Check cache first
    const cachedRecipes = getCachedSuggestions(itemName);
    if (cachedRecipes) {
      setSuggestedRecipes(cachedRecipes);
      return;
    }

    const controller = new AbortController();

    // Cache miss - fetch from API
    const fetchRecipes = async () => {
      setLoadingRecipes(true);
      try {
        const recipes = await spoonacularService.searchRecipes({
          query: itemName,
          number: 5,
          addRecipeInformation: true,
        }, controller.signal);
        const results = recipes.results as unknown as RecipeInformation[];
        setSuggestedRecipes(results);

        // Cache the results
        setCachedSuggestions(itemName, results);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch suggested recipes:', error);
      } finally {
        setLoadingRecipes(false);
      }
    };

    fetchRecipes();

    return () => controller.abort();
  }, [item?.itemName, getCachedSuggestions, setCachedSuggestions]);

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem({
              variables: { id: itemId },
            });
            goBack();
          } catch {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleAddToShoppingList = useCallback(async () => {
    if (!selectedShoppingListId) {
      Alert.alert(
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

    try {
      await addToShoppingList({
        variables: {
          input: {
            shoppingListId: selectedShoppingListId,
            itemId: data?.pantryItem?.item?.id || '',
            quantity: data?.pantryItem?.quantity || 1,
            unit: data?.pantryItem?.unit?.id
              ? { unitId: data.pantryItem.unit.id }
              : undefined,
            itemName: data?.pantryItem?.itemName || '',
          },
        },
      });
      setAddToListStatus('success');
      statusTimeoutRef.current = setTimeout(() => setAddToListStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to add to shopping list:', error);
      setAddToListStatus('error');
      statusTimeoutRef.current = setTimeout(() => setAddToListStatus('idle'), 3000);
    }
  }, [
    selectedShoppingListId,
    addToListStatus,
    addToShoppingList,
    data?.pantryItem,
    navigateTo,
  ]);

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

  const handleDiscardExpired = useCallback(() => {
    if (!item) return;
    Alert.alert(
      'Discard Expired Item',
      `This will mark the remaining ${item.quantity} ${item.unit?.name || ''} as wasted due to expiration.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => convertExpiredToWaste(item.id),
        },
      ],
    );
  }, [item, convertExpiredToWaste]);

  const handleConfirmAdjust = useCallback(
    (newQuantity: number, reason: string, remainingNetWeight?: number) => {
      if (!item) return;
      adjustQuantity(item.id, newQuantity, reason, item.version ?? undefined, remainingNetWeight);
    },
    [item, adjustQuantity],
  );

  const handleCorrectWeight = useCallback(
    (netWeight: number, reason: string, netWeightUnitId?: string) => {
      if (!item) return;
      correctWeight(item.id, netWeight, reason, item.version ?? 0, netWeightUnitId);
    },
    [item, correctWeight],
  );

  // Computed values
  const imageUrl = resolveImageUrl(item);
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
  const packageBreakdownText = formatPackageBreakdownFull(item?.packageBreakdown);
  const netWeightText = formatNetWeightDisplay(item?.netWeight, item?.netWeightUnit);
  const remainingNetWeightText = formatNetWeightDisplay(item?.remainingNetWeight, item?.netWeightUnit);
  const quantityBreakdownText = formatQuantityBreakdown(item?.quantityBreakdown, item?.unit?.symbol);

  if (!item) {
    return (
      <View style={styles.container}>
        <Header variant="detail" onBack={goBack} borderless />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        variant="detail"
        onBack={goBack}
        borderless
        rightActions={[
          {
            icon: addToListStatus === 'success' ? 'cart' : 'cart-outline',
            onPress: handleAddToShoppingList,
            variant: addToListStatus === 'success' ? 'success' : 'primary',
            loading: addToListStatus === 'loading',
            library: 'Ionicons',
            testID: 'pantry-item-add-to-list-button',
          },
          ...(item.condition === 'EXPIRED' && item.quantity > 0
            ? [{
                icon: 'close-circle-outline' as const,
                onPress: handleDiscardExpired,
                variant: 'error' as const,
                library: 'Ionicons' as const,
                testID: 'pantry-item-discard-button',
              }]
            : []),
          {
            icon: 'swap-vertical-outline',
            onPress: () => setAdjustModalVisible(true),
            library: 'Ionicons',
            testID: 'pantry-item-adjust-button',
          },
          {
            icon: 'create-outline',
            onPress: handleEdit,
            library: 'Ionicons',
            testID: 'pantry-item-edit-button',
          },
          {
            icon: 'trash-outline',
            onPress: handleDelete,
            variant: 'error',
            library: 'Ionicons',
            testID: 'pantry-item-delete-button',
          },
        ]}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery - show if images or fallback URL exists */}
        {showImages && (
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
        {(categoryName || storageStateDisplay) && (
          <View style={styles.categoryBadge}>
            <Icon
              name="restaurant-outline"
              size={16}
              color={theme.colors.primary}
              library="Ionicons"
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
              {daysInPantry !== null
                ? daysInPantry === 0
                  ? 'Today'
                  : daysInPantry === 1
                  ? '1 day'
                  : `${daysInPantry} days`
                : '-'}
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
              {item.quantity} {item.unit?.name}
            </Text>
          </View>
        </View>

        {/* Nutrition Summary - navigates to NutritionScreen */}
        {showNutrition && (
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

        {/* Quantity Row */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Quantity</Text>
          <View style={styles.infoValueContainer}>
            <View style={styles.infoIcon}>
              <Icon
                name="apps-outline"
                size={16}
                color={theme.colors.textSecondary}
                library="Ionicons"
              />
            </View>
            <Text style={styles.infoValue}>
              {item.quantity} {item.unit?.name}
            </Text>
          </View>
        </View>

        {/* Net Weight Row */}
        {netWeightText && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Net Weight</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="scale-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{netWeightText}</Text>
              {item.lastUsedAt && (
                <TouchableOpacity
                  onPress={() => setCorrectWeightVisible(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.correctWeightButton}
                >
                  <Icon
                    name="create-outline"
                    size={16}
                    color={theme.colors.primary}
                    library="Ionicons"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Remaining Weight Row - only show for dual-tracked items */}
        {remainingNetWeightText && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Remaining Weight</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="scale-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{remainingNetWeightText}</Text>
            </View>
          </View>
        )}

        {/* Inventory Breakdown Row - live remaining decomposition */}
        {quantityBreakdownText && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Inventory</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="layers-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{quantityBreakdownText}</Text>
            </View>
          </View>
        )}

        {/* Package Details Row - only show if breakdown is available */}
        {packageBreakdownText && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Package</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="layers-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{packageBreakdownText}</Text>
            </View>
          </View>
        )}

        {/* Brand Row - only show if brand is set */}
        {brandName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Brand</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="pricetag-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{brandName}</Text>
            </View>
          </View>
        )}

        {/* Storage Location */}
        {item.storageLocation && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Storage</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="cube-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {typeof item.storageLocation === 'string'
                  ? item.storageLocation
                  : item.storageLocation.name}
              </Text>
            </View>
          </View>
        )}

        {/* Store Row */}
        {item.store?.name && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Store</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="storefront-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>{item.store.name}</Text>
            </View>
          </View>
        )}

        {/* Condition Row - only show if not GOOD */}
        {formatCondition(item.condition) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Condition</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="fitness-outline"
                  size={16}
                  color={
                    item.condition === 'SPOILED' || item.condition === 'EXPIRED'
                      ? theme.colors.error
                      : theme.colors.warning
                  }
                  library="Ionicons"
                />
              </View>
              <Text
                style={[
                  styles.infoValue,
                  (item.condition === 'SPOILED' || item.condition === 'EXPIRED') && styles.infoValueError,
                  item.condition === 'FAIR' && styles.infoValueWarning,
                ]}
              >
                {formatCondition(item.condition)}
              </Text>
            </View>
          </View>
        )}

        {/* Acquired Via Row */}
        {formatAcquisitionMethod(item.acquisitionMethod) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acquired</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="bag-handle-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {formatAcquisitionMethod(item.acquisitionMethod)}
              </Text>
            </View>
          </View>
        )}

        {/* Cost Per Unit Row */}
        {formatCurrency(item.costPerUnit) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cost/Unit</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="cash-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {formatCurrency(item.costPerUnit)}
              </Text>
            </View>
          </View>
        )}

        {/* Total Cost Row */}
        {formatCurrency(item.totalCost) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Cost</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="wallet-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {formatCurrency(item.totalCost)}
              </Text>
            </View>
          </View>
        )}

        {/* Min Stock Row */}
        {item.minQuantity != null && item.minQuantity > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Min Stock</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="alert-circle-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {item.minQuantity} {item.unit?.name}
              </Text>
            </View>
          </View>
        )}

        {/* Restock At Row */}
        {item.restockQuantity != null && item.restockQuantity > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Restock At</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="refresh-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {item.restockQuantity} {item.unit?.name}
              </Text>
            </View>
          </View>
        )}

        {/* Purchase Date Row */}
        {item.purchase?.purchaseDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purchased</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="receipt-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {formatDate(item.purchase.purchaseDate)}
                {item.purchase.unitPrice != null &&
                  item.purchase.unitPrice > 0 &&
                  ` @ ${formatCurrency(item.purchase.unitPrice)}`}
              </Text>
            </View>
          </View>
        )}

        {/* Usage Info Row - show last used date if available */}
        {item.lastUsedAt && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Used</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="time-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {formatDate(item.lastUsedAt)}
              </Text>
            </View>
          </View>
        )}

        {/* Notes Section */}
        {item.storageNotes && (
          <View style={styles.notesSection}>
            <View style={styles.notesHeader}>
              <Icon
                name="document-text-outline"
                size={16}
                color={theme.colors.textSecondary}
                library="Ionicons"
              />
              <Text style={styles.notesLabel}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{item.storageNotes}</Text>
          </View>
        )}

        {/* Tags Section */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Tags</Text>
            <View style={styles.tagsContainer}>
              {item.tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Added Info - simplified purchase history */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Added</Text>
          <View style={styles.infoValueContainer}>
            <View style={styles.infoIcon}>
              <Icon
                name="calendar-outline"
                size={16}
                color={theme.colors.textSecondary}
                library="Ionicons"
              />
            </View>
            <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* Usage Records Section - only show if there are usage records */}
        {item.usageRecords && item.usageRecords.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() =>
                setPurchaseHistoryExpanded(!purchaseHistoryExpanded)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>
                Usage History ({item.usageRecords.length})
              </Text>
              <Icon
                name={purchaseHistoryExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textSecondary}
                library="Ionicons"
              />
            </TouchableOpacity>

            {purchaseHistoryExpanded && (
              <View style={styles.purchaseHistoryContent}>
                {item.usageRecords.slice(0, 5).map(usage => {
                  const isAdjustment = usage.purpose === UsagePurpose.Adjustment;
                  const purposeLabel = isAdjustment
                    ? 'Inventory adjusted'
                    : usage.purpose;
                  const quantityPrefix = isAdjustment
                    ? (usage.quantityUsed >= 0 ? '+' : '')
                    : '-';
                  return (
                    <View key={usage.id} style={styles.purchaseRow}>
                      <View style={styles.purchaseDateStore}>
                        <Text style={styles.purchaseDate}>
                          {formatDate(usage.usedAt)}
                        </Text>
                        {purposeLabel && (
                          <Text style={[
                            styles.purchaseStore,
                            isAdjustment && styles.adjustmentPurpose,
                          ]}>
                            {purposeLabel}
                          </Text>
                        )}
                        {isAdjustment && usage.adjustmentReason && (
                          <Text style={styles.adjustmentReason}>
                            {usage.adjustmentReason}
                          </Text>
                        )}
                      </View>
                      <Text style={[
                        styles.purchasePrice,
                        isAdjustment && styles.adjustmentQuantity,
                      ]}>
                        {quantityPrefix}{usage.quantityUsed}{usage.usageUnit?.symbol ? ` ${usage.usageUnit.symbol}` : ''}
                      </Text>
                    </View>
                  );
                })}
                {item.usageRecords.length > 5 && (
                  <Text style={styles.noPurchaseData}>
                    +{item.usageRecords.length - 5} more entries
                  </Text>
                )}
              </View>
            )}
          </>
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
            <FlatList
              horizontal
              data={suggestedRecipes}
              keyExtractor={recipe => String(recipe.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipesList}
              renderItem={({ item: recipe }) => (
                <TouchableOpacity
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe.id)}
                  activeOpacity={0.8}
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
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={styles.noRecipes}>
              No recipe suggestions available
            </Text>
          )}
        </View>

        {/* Bottom padding for safe area */}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {adjustModalVisible && (
        <AdjustQuantityModal
          visible={adjustModalVisible}
          pantryItem={item}
          onClose={() => setAdjustModalVisible(false)}
          onConfirm={handleConfirmAdjust}
        />
      )}

      {correctWeightVisible && (
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
  heroImage: {
    width: 200,
    height: 200,
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
  expiryText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  expiryUrgent: {
    color: theme.colors.warning,
  },
  expiryExpired: {
    color: theme.colors.error,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: theme.spacing.xs,
  },
  infoValue: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  infoValueMuted: {
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  correctWeightButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  infoValueError: {
    color: theme.colors.error,
  },
  infoValueWarning: {
    color: theme.colors.warning,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  purchaseHistoryContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  purchaseDateStore: {
    flex: 1,
  },
  purchaseDate: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  purchaseStore: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  purchasePrice: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  noPurchaseData: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  adjustmentPurpose: {
    color: theme.colors.info,
  },
  adjustmentReason: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    marginTop: 1,
  },
  adjustmentQuantity: {
    color: theme.colors.info,
  },
  notesSection: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  notesLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  notesText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  tagsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  tagsLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
  tagText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
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
}));
