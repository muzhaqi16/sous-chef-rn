import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { DetailSection } from '#components/molecules/DetailSection';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { CachedImage } from '#components/atoms/CachedImage';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { useTranslation } from '#/i18n';
import { usePantryItemDetailData } from '#features/pantry/hooks/usePantryItemDetailData';
import {
  useSelectedShoppingListId,
  useSelectedPantryId,
} from '#store/useAppStore';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { resolveImageUrl, galleryPhotos } from '#utils/imageUtils';
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
import { parseNutritions, hasNutritionData } from '#domain/nutrition';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { GalleryHero } from '#features/catalog/ui/GalleryHero';
import { ItemPhotoViewer } from '#features/catalog/ui/ItemPhotoViewer/ItemPhotoViewer';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { Icon } from '#/utils/iconUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BatchSection } from '#features/pantry/components/BatchSection';
import { AdjustQuantityModal } from '#features/pantry/components/modals/AdjustQuantityModal';
import { CorrectWeightModal } from '#features/pantry/components/modals/CorrectWeightModal';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { useRecipeSuggestionsForItem } from '#features/pantry/hooks/useRecipeSuggestionsForItem';
import { usePantryItemDetailActions } from '#features/pantry/hooks/usePantryItemDetailActions';
import { commonStyles } from '#/styles/commonStyles';

/**
 * Extracted so `styles.useVariants` is called once per instance.
 */
const ExpiryColumnText: React.FC<{
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
}> = ({ text, isUrgent, isExpired }) => {
  const status = isExpired ? 'expired' : isUrgent ? 'urgent' : 'normal';
  styles.useVariants({ expiryStatus: status });
  return (
    <Text role="label" style={styles.infoColumnValue}>
      {text}
    </Text>
  );
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
    toRecipeDetail,
    toNutritionScreen,
    toPantryBatchHistory,
    toPantryUsageHistory,
  } = useAppNavigation();
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();
  const [refreshing, setRefreshing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const {
    item,
    batches,
    batchPricing,
    batchTotalCount,
    deletedOnServer,
    itemLoading,
    itemError,
    isUnconfirmed,
    refreshAll,
  } = usePantryItemDetailData(itemId);

  const handleRefresh = () => {
    executeRefreshWithFinally(refreshAll, setRefreshing);
  };

  const permissions = usePantryPermissions();

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
        t('pantryItemDetail.noShoppingListSelectedTitle'),
        t('pantryItemDetail.noShoppingListSelectedMessage'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          {
            text: t('pantryItemDetail.goToShoppingLists'),
            onPress: toShoppingListMain,
          },
        ],
      ),
  });

  const handleEdit = () => {
    toPantryItem({ itemId });
  };

  const handleRecipePress = (recipeId: number) => {
    toRecipeDetail({
      externalSource: 'SPOONACULAR',
      externalId: String(recipeId),
    });
  };

  const imageUrl = resolveImageUrl(item, 'large');
  const expiryInfo = getExpiryInfo(item?.expiresAt);
  const daysInPantry = getDaysInPantry(item?.createdAt);
  const storageStateDisplay = formatStorageState(item?.storageState, t);
  const brandName = item?.brand?.name || null;
  const categoryName = item?.item?.categories?.[0]?.category?.name || null;
  const itemPhotos = galleryPhotos(item?.item?.photos);
  const itemNutritions = parseNutritions(item?.item?.nutritions);
  const showImages = itemPhotos.length > 0 || !!imageUrl;
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

  // Classified so an offline cache miss reports itself instead of spinning
  // forever on a bare loader.
  const itemState = useDataState({
    // An unconfirmed create IS a load in progress: the query is skipped and
    // fires the moment the create lands, so the skip must not read as empty.
    loading: itemLoading || isUnconfirmed,
    error: itemError,
    // "Something to show" is the cache entity, not `data`. `deletedOnServer`
    // overrides it, and is deliberately narrow — only an explicit
    // RESOURCE_NOT_FOUND on an acknowledged row, so offline hides nothing.
    hasResult: !!item && !deletedOnServer,
    isEmpty: !item || deletedOnServer,
  });

  if (!item || deletedOnServer) {
    return (
      <CollapsingHeroDetail onBack={goBack} testID="pantry-item-detail">
        <View style={commonStyles.loadingContainer}>
          <DataStateView state={itemState} onRetry={handleRefresh} />
        </View>
      </CollapsingHeroDetail>
    );
  }

  const hasExpiredBatches =
    (item.condition === 'EXPIRED' && item.quantity > 0) ||
    batches.some(
      batch =>
        batch.status === 'ACTIVE' &&
        !!batch.expiresAt &&
        new Date(batch.expiresAt) < new Date(),
    );

  const discardActions: HeaderAction[] =
    hasExpiredBatches && permissions.canEditItems
      ? [
          {
            icon: 'close-circle-outline',
            accessibilityLabel: t('labels.discard'),
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
            accessibilityLabel: t('labels.addToShoppingList'),
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
            accessibilityLabel: t('adjustQuantity.title'),
            onPress: () => actions.setAdjustModalVisible(true),
            testID: 'pantry-item-adjust-button',
          },
          {
            icon: 'create-outline',
            accessibilityLabel: t('labels.edit'),
            onPress: handleEdit,
            testID: 'pantry-item-edit-button',
          },
          {
            icon: 'trash-outline',
            accessibilityLabel: t('labels.delete'),
            onPress: actions.handleDelete,
            variant: 'error',
            testID: 'pantry-item-delete-button',
          },
        ] satisfies HeaderAction[])
      : []),
  ];

  return (
    <>
      <CollapsingHeroDetail
        testID="pantry-item-detail"
        onBack={goBack}
        actions={headerActions}
        title={item.itemName}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        parallax
        renderHero={
          showImages
            ? heroHeight => (
                <GalleryHero
                  photos={itemPhotos}
                  fallbackImageUrl={imageUrl}
                  height={heroHeight}
                  onPhotoPress={setViewerIndex}
                />
              )
            : undefined
        }
      >
        <DetailTitleRow
          title={item.itemName}
          numberOfLines={2}
          trailing={
            <Text role="heading" style={styles.quantityBadge}>
              {item.quantity} {getUnitDisplayText(item.unit)}
            </Text>
          }
        />

        {!!(categoryName || storageStateDisplay) && (
          <View style={styles.categoryBadge}>
            <Icon name="restaurant-outline" size={16} tone="primary" />
            <Text role="label" style={styles.categoryText}>
              {categoryName || t('labels.item')}
              {storageStateDisplay
                ? t('pantryItemDetail.inLocation', {
                    location: storageStateDisplay,
                  })
                : ''}
            </Text>
          </View>
        )}

        <DetailSection>
          <View style={styles.infoColumns}>
            <View style={styles.infoColumn}>
              <Text role="caption" style={styles.infoColumnLabel}>
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
        </DetailSection>

        {!!showNutrition && (
          <DetailSection title={t('pantryItemDetail.nutrition')}>
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
          </DetailSection>
        )}

        <DetailSection>
          <PantryDetailInfo
            itemRef={item}
            brandName={brandName}
            netWeightText={netWeightText}
            remainingNetWeightText={remainingNetWeightText}
            quantityBreakdownText={quantityBreakdownText}
            packageBreakdownText={packageBreakdownText}
            shelfLifeDays={item.item?.shelfLifeDays}
            shelfLifeOpenedDays={item.item?.shelfLifeOpenedDays}
            onCorrectWeight={() => actions.setCorrectWeightVisible(true)}
            pricing={batchPricing}
          />
        </DetailSection>

        {batches.length > 1 && (
          <DetailSection flush>
            <BatchSection
              batches={batches}
              unitSymbol={item.unit?.symbol ?? undefined}
              totalCount={batchTotalCount}
              onViewAll={() =>
                toPantryBatchHistory({
                  pantryItemId: itemId,
                  itemName: item.itemName ?? '',
                  unitSymbol: item.unit?.symbol ?? undefined,
                })
              }
            />
          </DetailSection>
        )}

        {!!item.usageRecords && item.usageRecords.edges.length > 0 && (
          <DetailSection>
            <PantryUsageHistory
              usageRecords={item.usageRecords.edges}
              totalCount={item.usageRecords.totalCount ?? undefined}
              onViewAll={() =>
                toPantryUsageHistory({
                  pantryItemId: itemId,
                  itemName: item.itemName ?? '',
                })
              }
            />
          </DetailSection>
        )}

        <DetailSection title={t('pantryItemDetail.recipesToTry')}>
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
                <AppPressable
                  key={String(recipe.id)}
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe.id)}
                >
                  <CachedImage
                    uri={recipe.image}
                    style={styles.recipeImage}
                    sharedTransitionTag={`recipe-image-${recipe.id}`}
                  />
                  <Text
                    role="label"
                    style={styles.recipeTitle}
                    numberOfLines={2}
                  >
                    {recipe.title}
                  </Text>
                </AppPressable>
              ))}
            </ScrollView>
          ) : (
            <Text role="caption" style={styles.noRecipes}>
              {t('pantryItemDetail.noRecipeSuggestions')}
            </Text>
          )}
        </DetailSection>
      </CollapsingHeroDetail>

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
      {itemPhotos.length > 0 && (
        <ItemPhotoViewer
          visible={viewerIndex !== null}
          photos={itemPhotos}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
          canEdit={!!item.item?.canEdit}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  quantityBadge: {
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
    color: theme.colors.primary,
  },
  infoColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoColumn: {
    alignItems: 'center',
    flex: 1,
  },
  infoColumnLabel: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoColumnValue: {
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
  recipesLoading: {
    marginTop: theme.spacing.sm,
  },
  recipesList: {
    paddingTop: theme.spacing.xs,
  },
  recipeCard: {
    width: 140,
    marginRight: theme.spacing.md,
  },
  recipeImage: {
    width: 140,
    height: 100,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  recipeTitle: {
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  noRecipes: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
}));
