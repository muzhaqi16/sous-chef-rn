import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  useGetPantryItemQuery,
  useDeletePantryItemMutation,
  useAddItemToShoppingListMutation,
  StorageState,
} from '#generated';
import { useAppStore, selectSelectedShoppingListId } from '#store/useAppStore';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks';
import { PantryStackParamList } from '#navigation/stacks/PantryStack';
import { getItemImageUrl } from '#utils/imageUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '#/utils';
import { spoonacularService } from '#/services/recipeApi';
import type { RecipeInformation } from '#/services/recipeApi/types';

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
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
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

export const PantryItemDetail: React.FC<{
  route: { params: PantryStackParamList['PantryItemDetail'] };
}> = ({ route }) => {
  const itemId = route.params.itemId;
  const { goBack, navigate, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const selectedShoppingListId = useAppStore(selectSelectedShoppingListId);

  const [addToListStatus, setAddToListStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [purchaseHistoryExpanded, setPurchaseHistoryExpanded] = useState(false);

  // Recipes to try state (dev only)
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeInformation[]>(
    [],
  );
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const { data } = useGetPantryItemQuery({
    variables: { id: itemId },
    fetchPolicy: 'cache-first',
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

  const item = data?.pantryItem;

  // Fetch suggested recipes (dev only)
  useEffect(() => {
    if (!__DEV__ || !item?.item?.name) return;

    const fetchRecipes = async () => {
      setLoadingRecipes(true);
      try {
        const recipes = await spoonacularService.searchRecipes({
          query: item.item?.name || '',
          number: 5,
          addRecipeInformation: true,
        });
        setSuggestedRecipes(recipes.results as unknown as RecipeInformation[]);
      } catch (error) {
        console.error('Failed to fetch suggested recipes:', error);
      } finally {
        setLoadingRecipes(false);
      }
    };

    fetchRecipes();
  }, [item?.item?.name]);

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
          } catch (error) {
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
            quantity: data?.pantryItem?.currentQuantity || 1,
            unitId: data?.pantryItem?.unit?.id || '',
            itemName: data?.pantryItem?.item?.name || '',
          },
        },
      });
      setAddToListStatus('success');
      setTimeout(() => setAddToListStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to add to shopping list:', error);
      setAddToListStatus('error');
      setTimeout(() => setAddToListStatus('idle'), 3000);
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
    navigate('RecipeDetail', {
      externalSource: 'SPOONACULAR',
      externalId: String(recipeId),
    });
  };

  // Computed values
  const imageUrl = getItemImageUrl(item?.item);
  const expiryInfo = getExpiryInfo(item?.expiresAt);
  const daysInPantry = getDaysInPantry(item?.createdAt);
  const storageStateDisplay = formatStorageState(item?.storageState);
  // Use pantryItem's specific brand (not item.brands which contains all brands for the item type)
  const brandName = item?.brand?.name || null;
  // Get category name for display
  const categoryName = item?.item?.categories?.[0]?.category?.name || null;

  if (!item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
              library="Ionicons"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
            library="Ionicons"
          />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleAddToShoppingList}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={addToListStatus === 'loading'}
          >
            <Icon
              name={addToListStatus === 'success' ? 'cart' : 'cart-outline'}
              size={24}
              color={addToListStatus === 'success' ? theme.colors.success : theme.colors.primary}
              library="Ionicons"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEdit}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="create-outline"
              size={24}
              color={theme.colors.textPrimary}
              library="Ionicons"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="trash-outline"
              size={24}
              color={theme.colors.error}
              library="Ionicons"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image - only show if image exists */}
        {imageUrl && (
          <View style={styles.imageSection}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Title Row - Name */}
        <View style={styles.titleRow}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.item?.name || item.itemName}
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
              {item.packageWeight != null && item.packageWeight > 0
                ? `${item.packageWeight} ${item.packageWeightUnit?.symbol || 'g'}`
                : `${item.currentQuantity} ${item.unit?.symbol || 'pcs'}`}
            </Text>
          </View>
        </View>

        {/* Brand Row - always show, "Unbranded" if null */}
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
            <Text style={[styles.infoValue, !brandName && styles.infoValueMuted]}>
              {brandName || 'Unbranded'}
            </Text>
          </View>
        </View>

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

        {/* Weight Row */}
        {item.packageWeight != null && item.packageWeight > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="scale-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                  library="Ionicons"
                />
              </View>
              <Text style={styles.infoValue}>
                {item.packageWeight} {item.packageWeightUnit?.symbol || 'g'}
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

        {/* Usage Info Row */}
        {(item.lastUsedAt || item.consumedQuantity > 0) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Usage</Text>
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
                {item.consumedQuantity > 0 && `Used ${item.consumedQuantity}`}
                {item.consumedQuantity > 0 && item.lastUsedAt && ' • '}
                {item.lastUsedAt && `Last: ${formatDate(item.lastUsedAt)}`}
              </Text>
            </View>
          </View>
        )}

        {/* Waste Info Row */}
        {item.wasteAmount > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Waste</Text>
            <View style={styles.infoValueContainer}>
              <View style={styles.infoIcon}>
                <Icon
                  name="trash-outline"
                  size={16}
                  color={theme.colors.error}
                  library="Ionicons"
                />
              </View>
              <Text style={[styles.infoValue, styles.infoValueError]}>
                {item.wasteAmount} wasted
                {item.wasteReason && ` (${item.wasteReason.toLowerCase().replace('_', ' ')})`}
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
              onPress={() => setPurchaseHistoryExpanded(!purchaseHistoryExpanded)}
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
                {item.usageRecords.slice(0, 5).map(usage => (
                  <View key={usage.id} style={styles.purchaseRow}>
                    <View style={styles.purchaseDateStore}>
                      <Text style={styles.purchaseDate}>
                        {formatDate(usage.usedAt)}
                      </Text>
                      {usage.purpose && (
                        <Text style={styles.purchaseStore}>{usage.purpose}</Text>
                      )}
                    </View>
                    <Text style={styles.purchasePrice}>
                      -{usage.quantityUsed}
                    </Text>
                  </View>
                ))}
                {item.usageRecords.length > 5 && (
                  <Text style={styles.noPurchaseData}>
                    +{item.usageRecords.length - 5} more entries
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Recipes to try (dev only) */}
        {__DEV__ && (
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
                    <Image
                      source={{ uri: recipe.image }}
                      style={styles.recipeImage}
                      resizeMode="cover"
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
        )}

        {/* Bottom padding for safe area */}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerButton: {
    padding: theme.spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
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
  infoValueError: {
    color: theme.colors.error,
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
