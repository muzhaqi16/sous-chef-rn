import React, { useState } from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import {
  Pressable,
  ThemedActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import Animated from 'react-native-reanimated';
import { useApolloClient, useQuery } from '@apollo/client/react';
import {
  PantryItemFragmentDoc,
  type PantryItemFragment,
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { useTranslation } from 'react-i18next';
import { GetPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  useSelectedShoppingListId,
  useSelectedPantryId,
} from '#store/useAppStore';
import { StyleSheet } from 'react-native-unistyles';
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
} from '#features/pantry/hooks/usePantryItemTransformation';
import { getUnitDisplayText } from '#utils/formatQuantity';
import { PantryDetailInfo } from '#features/pantry/components/PantryDetailInfo';
import { PantryUsageHistory } from '#features/pantry/components/PantryUsageHistory';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, type HeaderAction } from '#components/molecules/Header';
import { Icon } from '#/utils/iconUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BatchSection } from '#features/pantry/components/BatchSection';
import { AdjustQuantityModal } from '#components/modals/AdjustQuantityModal';
import { CorrectWeightModal } from '#components/modals/CorrectWeightModal';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { useRecipeSuggestionsForItem } from '#features/pantry/hooks/useRecipeSuggestionsForItem';
import { usePantryItemDetailActions } from '#features/pantry/hooks/usePantryItemDetailActions';

/**
 * Expiry column text. Extracted so `styles.useVariants` is called once per
 * instance — combining `styles.X` references in an array would violate the
 * project's no-restricted-syntax rule.
 */
const ExpiryColumnText: React.FC<{
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
}> = ({ text, isUrgent, isExpired }) => {
  const status = isExpired ? 'expired' : isUrgent ? 'urgent' : 'normal';
  styles.useVariants({ expiryStatus: status });
  return <Text style={styles.infoColumnValue}>{text}</Text>;
};

export const PantryItemDetail: React.FC<
  StaticScreenProps<{
    itemId: string;
  }>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('PantryItemDetail');
  const itemId = route.params.itemId;
  const {
    goBack,
    toShoppingListMain,
    toPantryItem,
    toPantryRecipeDetail,
    toNutritionScreen,
  } = useAppNavigation();
  const insets = useSafeAreaInsets();
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();

  const [purchaseHistoryExpanded, setPurchaseHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId },
  });
  const client = useApolloClient();

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const permissions = usePantryPermissions();
  // Materialize the masked PantryItem ref into a fully unmasked entity.
  // `cache.readFragment` returns the unmasked shape (Apollo's signature),
  // inlining nested fragment fields so the screen and downstream components
  // can access them directly. The outer `useQuery` subscription drives
  // re-renders when the entity changes.
  const item = data?.pantryItem
    ? client.cache.readFragment<PantryItemFragment>({
        fragment: PantryItemFragmentDoc,
        fragmentName: 'PantryItemFragment',
        from: data.pantryItem,
      })
    : null;

  const { suggestedRecipes, loadingRecipes } = useRecipeSuggestionsForItem(
    item?.itemName ?? undefined,
  );

  const actions = usePantryItemDetailActions({
    itemId,
    item,
    selectedPantryId,
    selectedShoppingListId,
    goBack,
    onAddToShoppingListNeedsList: () =>
      alertService.alert(
        'No Shopping List Selected',
        'Please select a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Shopping Lists',
            onPress: toShoppingListMain,
          },
        ],
      ),
  });

  const handleEdit = () => {
    toPantryItem({ itemId });
  };

  const handleRecipePress = (recipeId: number) => {
    toPantryRecipeDetail({
      externalSource: 'SPOONACULAR',
      externalId: String(recipeId),
    });
  };

  // Computed display values
  const imageUrl = resolveImageUrl(item, 'large');
  const expiryInfo = getExpiryInfo(item?.expiresAt);
  const daysInPantry = getDaysInPantry(item?.createdAt);
  const storageStateDisplay = formatStorageState(item?.storageState);
  const brandName = item?.brand?.name || null;
  const categoryName = item?.item?.categories?.[0]?.category?.name || null;
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
          <SousChefLoader
            size="small"
            showBrand={false}
            message={t('pantryItemDetail.loading')}
          />
        </View>
      </View>
    );
  }

  // batches are masked fragment refs — materialize each via cache.readFragment
  // to inspect status/expiresAt for the discard-expired affordance.
  const hasExpiredBatches =
    (item.condition === 'EXPIRED' && item.quantity > 0) ||
    item.batches?.some(batchRef => {
      const batch = client.cache.readFragment<PantryItemBatchFragment>({
        fragment: PantryItemBatchFragmentDoc,
        fragmentName: 'PantryItemBatchFragment',
        from: batchRef,
      });
      return (
        batch?.status === 'ACTIVE' &&
        !!batch.expiresAt &&
        new Date(batch.expiresAt) < new Date()
      );
    });

  const discardActions: HeaderAction[] =
    hasExpiredBatches && permissions.canEditItems
      ? [
          {
            icon: 'close-circle-outline',
            onPress: actions.handleDiscardExpired,
            variant: 'error',
            testID: 'pantry-item-discard-button',
          },
        ]
      : [];

  const headerActions: HeaderAction[] = [
    ...(permissions.canAddItems
      ? [
          {
            icon:
              actions.addToListStatus === 'success' ? 'cart' : 'cart-outline',
            onPress: actions.handleAddToShoppingList,
            variant:
              actions.addToListStatus === 'success' ? 'success' : 'primary',
            loading: actions.addToListStatus === 'loading',
            testID: 'pantry-item-add-to-list-button',
          } satisfies HeaderAction,
        ]
      : []),
    ...discardActions,
    ...(permissions.canEditItems
      ? ([
          {
            icon: 'swap-vertical-outline',
            onPress: () => actions.setAdjustModalVisible(true),
            testID: 'pantry-item-adjust-button',
          },
          {
            icon: 'create-outline',
            onPress: handleEdit,
            testID: 'pantry-item-edit-button',
          },
          {
            icon: 'trash-outline',
            onPress: actions.handleDelete,
            variant: 'error',
            testID: 'pantry-item-delete-button',
          },
        ] satisfies HeaderAction[])
      : []),
  ];

  return (
    <View style={styles.container}>
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
        {!!showImages && (
          <View style={styles.imageSection}>
            <ImageGalleryTabs
              images={itemImages}
              fallbackImageUrl={imageUrl}
              imageHeight={200}
            />
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.itemName}
          </Text>
        </View>

        {!!(categoryName || storageStateDisplay) && (
          <View style={styles.categoryBadge}>
            <Icon name="restaurant-outline" size={16} tone="primary" />
            <Text style={styles.categoryText}>
              {categoryName || t('pantryItemDetail.item')}
              {storageStateDisplay
                ? t('pantryItemDetail.inLocation', {
                    location: storageStateDisplay,
                  })
                : ''}
            </Text>
          </View>
        )}

        <View style={styles.infoColumns}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>
              {t('pantryItemDetail.inThePantry')}
            </Text>
            <Text style={styles.infoColumnValue}>
              {formatDaysInPantry(daysInPantry)}
            </Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>
              {t('pantryItemDetail.expiring')}
            </Text>
            <ExpiryColumnText
              text={expiryInfo?.text || t('pantryItemDetail.noExpiry')}
              isUrgent={!!expiryInfo?.isUrgent}
              isExpired={!!expiryInfo?.isExpired}
            />
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoColumnLabel}>
              {t('pantryItemDetail.amount')}
            </Text>
            <Text style={styles.infoColumnValue}>
              {item.quantity} {getUnitDisplayText(item.unit)}
            </Text>
          </View>
        </View>

        {!!showNutrition && (
          <View style={styles.nutritionSection}>
            <Text style={styles.nutritionTitle}>
              {t('pantryItemDetail.nutrition')}
            </Text>
            <NutritionSummary
              nutritions={itemNutritions}
              showHighlights
              onPress={() =>
                toNutritionScreen({
                  itemId: item.id,
                  itemName: item.itemName,
                  nutritions: item.item?.nutritions,
                })
              }
            />
          </View>
        )}

        <PantryDetailInfo
          item={item}
          brandName={brandName}
          netWeightText={netWeightText}
          remainingNetWeightText={remainingNetWeightText}
          quantityBreakdownText={quantityBreakdownText}
          packageBreakdownText={packageBreakdownText}
          shelfLifeDays={item.item?.shelfLifeDays}
          shelfLifeOpenedDays={item.item?.shelfLifeOpenedDays}
          onCorrectWeight={() => actions.setCorrectWeightVisible(true)}
        />

        {!!item.batches && item.batches.length > 1 && (
          <BatchSection
            batches={item.batches}
            pantryItemId={item.id}
            unitSymbol={item.unit?.symbol ?? undefined}
          />
        )}

        {!!item.usageRecords && item.usageRecords.edges.length > 0 && (
          <PantryUsageHistory
            usageRecords={item.usageRecords.edges}
            expanded={purchaseHistoryExpanded}
            onToggle={() =>
              setPurchaseHistoryExpanded(!purchaseHistoryExpanded)
            }
          />
        )}

        <View style={styles.recipesSection}>
          <Text style={styles.sectionTitle}>
            {t('pantryItemDetail.recipesToTry')}
          </Text>
          {loadingRecipes ? (
            <ThemedActivityIndicator
              size="small"
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

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {!!actions.adjustModalVisible && (
        <AdjustQuantityModal
          visible={actions.adjustModalVisible}
          pantryItemId={itemId}
          onClose={() => actions.setAdjustModalVisible(false)}
          onConfirm={actions.handleConfirmAdjust}
        />
      )}

      {!!actions.correctWeightVisible && (
        <CorrectWeightModal
          visible={actions.correctWeightVisible}
          pantryItemId={itemId}
          onClose={() => actions.setCorrectWeightVisible(false)}
          onConfirm={actions.handleCorrectWeight}
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
    variants: {
      expiryStatus: {
        normal: {},
        urgent: { color: theme.colors.warning },
        expired: { color: theme.colors.error },
      },
    },
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
