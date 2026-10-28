import { pantryTestIDs } from '#features/pantry/testIDs';
import { catalogTestIDs } from '#features/catalog/testIDs';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DetailSection } from '#components/molecules/DetailSection';
import { HorizontalRail } from '#components/molecules/HorizontalRail';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { CachedImage } from '#components/atoms/CachedImage';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { DataStateView } from '#components/organisms/DataStateView';
import { EmptyState } from '#components/molecules/EmptyState';
import { useDataState } from '#hooks/data/useDataState';
import { useTranslation } from '#/i18n';
import { usePantryItemDetailData } from './usePantryItemDetailData';
import {
  useSelectedHomeId,
  useSelectedShoppingListId,
  useSelectedPantryId,
} from '#store/useAppStore';
import { StyleSheet } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { resolveImageUrl } from '#utils/imageUtils';
import {
  formatHeldAmount,
  formatPackageBreakdownFull,
  formatQuantityBreakdown,
  formatStorageState,
  getExpiryInfo,
  getDaysInPantry,
  formatDaysInPantry,
} from '#features/pantry/hooks/usePantryItemTransformation';
import { formatNetWeightDisplay } from '#utils/formatQuantity';
import { currentReading, formatReading } from '#domain/measure';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import {
  BatchStatus,
  EntryImageSource,
  ItemCondition,
} from '#/graphql/generated/schemaTypes';
import { PantryDetailInfo } from '#features/pantry/components/PantryDetailInfo';
import { PantryUsageHistory } from '#features/pantry/components/PantryUsageHistory';
import { hasNutritionData, toShownNutrition } from '#domain/nutrition';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { GalleryHero } from '#features/catalog/ui/GalleryHero';
import { ItemPhotoViewer } from '#features/catalog/ui/ItemPhotoViewer/ItemPhotoViewer';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { useReportPhotoHeaderAction } from '#features/catalog/ui/useReportPhotoHeaderAction';
import { entryGallery } from '#features/catalog/ui/entryGallery';
import { EntryPhotoSheet } from '#features/catalog/ui/EntryPhotoSheet';
import { useEntryPhoto } from '#features/catalog/hooks/useEntryPhoto';
import { RelinkItemSheet } from '#features/pantry/components/RelinkItemSheet';
import { Icon } from '#components/atoms/Icon';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BatchSection } from '#features/pantry/components/BatchSection';
import { AdjustQuantityModal } from '#features/pantry/components/modals/AdjustQuantityModal';
import { CorrectPackageSizeModal } from '#features/pantry/components/modals/CorrectPackageSizeModal';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import {
  useRecipeSuggestionsForItem,
  type ItemRecipeSuggestion,
} from '#features/pantry/hooks/useRecipeSuggestionsForItem';
import { catalogHintOf } from '#features/recipes/hooks/useOpenCatalogRecipe';
import { usePantryItemDetailActions } from '#features/pantry/hooks/usePantryItemDetailActions';
import { commonStyles } from '#/styles/commonStyles';
import { daysUntilExpiry } from '#domain/expiry';
import { catalogKey } from '#domain/catalogRecipes';
import { useToday } from '#hooks/app/useToday';

/**
 * Extracted so `styles.useVariants` is called once per instance.
 */
const ExpiryColumnText: React.FC<{
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
}> = ({ text, isUrgent, isExpired }) => (
  <Text
    role="label"
    tone={isExpired ? 'danger' : isUrgent ? 'warning' : 'primary'}
    align="center"
  >
    {text}
  </Text>
);

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
    replaceWithPantryItemDetail,
  } = useAppNavigation();
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();
  const selectedHomeId = useSelectedHomeId();
  const today = useToday();
  const readingSystem = useReadingSystem();
  const [refreshing, setRefreshing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [relinkVisible, setRelinkVisible] = useState(false);

  const {
    item,
    batches,
    batchPricing,
    batchTotalCount,
    deletedOnServer,
    mergedIntoId,
    itemLoading,
    itemError,
    isUnconfirmed,
    refreshAll,
  } = usePantryItemDetailData(itemId);

  // Merged away: the survivor takes this screen's place, so Back still leads
  // where it did.
  useEffect(() => {
    if (mergedIntoId) replaceWithPantryItemDetail({ itemId: mergedIntoId });
  }, [mergedIntoId, replaceWithPantryItemDetail]);

  const handleRefresh = () => {
    void executeRefreshWithFinally(refreshAll, setRefreshing);
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

  const entryPhoto = useEntryPhoto(selectedHomeId, item?.itemId);

  const handleEdit = () => {
    toPantryItem({ itemId });
  };

  const handleRecipePress = (recipe: ItemRecipeSuggestion) => {
    toRecipeDetail({ catalog: catalogHintOf(recipe) });
  };

  const imageUrl = resolveImageUrl(item, 'large');
  const expiryInfo = getExpiryInfo(item?.expiresOn, today, t);
  const daysInPantry = getDaysInPantry(item?.createdAt);
  const storageStateDisplay = formatStorageState(item?.storageState, t);
  const brandName = item?.brand?.name ?? null;
  const categoryName = item?.item.categories[0]?.category.name ?? null;
  const gallery = entryGallery(item?.image, item?.item.photos);
  const reportPhoto = useReportPhotoHeaderAction(
    item?.item,
    item?.image,
    gallery,
    pantryTestIDs.itemReportPhotoButton,
  );
  const itemPhotos = gallery.photos;
  // The viewer offers "Use this photo" on every photo but the one in use.
  const pickableIndex = itemPhotos.findIndex(
    photo => photo.id !== item?.image?.catalogImageId,
  );
  const nutrition = toShownNutrition(item?.item.shownNutrition);
  const nutritionFacts = nutrition?.facts ?? null;
  // A concept's typical values, titled as such and making no health claim.
  const typicalOf = nutrition?.typicalOf ?? null;
  const showImages =
    itemPhotos.length > 0 || !!imageUrl || !!gallery.leadImageUrl;
  const showNutrition = hasNutritionData(nutritionFacts);
  // Each weight reads in the user's unit system while its Measure still
  // describes the stored figure; after a local edit, as stored until the
  // server answers with new readings.
  const packageBreakdownText = formatPackageBreakdownFull(
    item?.packageBreakdown,
    t,
    readingSystem,
  );
  const netWeightUnitId = item?.netWeightUnit?.id;
  const packageSizeReading = currentReading(
    item?.packageSize,
    { value: item?.netWeight, unitId: netWeightUnitId },
    readingSystem,
  );
  const netWeightText = packageSizeReading
    ? formatReading(packageSizeReading)
    : formatNetWeightDisplay(item?.netWeight, item?.netWeightUnit);
  const remainingReading = currentReading(
    item?.remaining,
    { value: item?.remainingNetWeight, unitId: netWeightUnitId },
    readingSystem,
  );
  const remainingNetWeightText = remainingReading
    ? formatReading(remainingReading)
    : formatNetWeightDisplay(item?.remainingNetWeight, item?.netWeightUnit);
  const quantityBreakdownText = formatQuantityBreakdown(
    item?.quantityBreakdown,
    t,
  );
  const portionsLeftText =
    item?.remainingPortions != null && item.portionUnit
      ? t('pantryItemCard.portionsLeft', {
          count: item.remainingPortions,
          unit: item.portionUnit.symbol || item.portionUnit.name,
        })
      : null;

  // Classified so an offline cache miss reports itself instead of spinning
  // forever on a bare loader.
  const itemState = useDataState({
    // An unconfirmed create IS a load in progress: the query is skipped and
    // fires the moment the create lands, so the skip must not read as empty.
    loading: itemLoading || isUnconfirmed,
    error: itemError,
    // "Something to show" is the cache entity, not `data`.
    hasResult: !!item,
    isEmpty: !item,
  });

  // The server answered that the stack is gone. That is an answer, not a
  // failed load: it gets its own words and a way back, never "try again".
  if (deletedOnServer) {
    return (
      <CollapsingHeroDetail onBack={goBack} testID={pantryTestIDs.itemDetail}>
        <View style={commonStyles.loadingContainer}>
          <EmptyState
            icon="trash-outline"
            title={t('pantryItemDetail.removedTitle')}
            description={t('pantryItemDetail.removedBody')}
            action={{ label: t('labels.goBack'), onPress: goBack }}
            testID={pantryTestIDs.itemRemoved}
          />
        </View>
      </CollapsingHeroDetail>
    );
  }

  if (!item) {
    return (
      <CollapsingHeroDetail onBack={goBack} testID={pantryTestIDs.itemDetail}>
        <View style={commonStyles.loadingContainer}>
          <DataStateView state={itemState} onRetry={handleRefresh} />
        </View>
      </CollapsingHeroDetail>
    );
  }

  const quantityText = formatHeldAmount(item, readingSystem);

  // The EXPIRED flag can land a day late east of UTC, so the date decides too.
  // The batches' date, not the item's: an edit moves only the item's, and the
  // server discards only expired batches.
  const hasExpiredBatches =
    (item.quantity > 0 &&
      (item.condition === ItemCondition.Expired ||
        (!!item.earliestBatchExpiresOn &&
          daysUntilExpiry(item.earliestBatchExpiresOn, today) < 0))) ||
    batches.some(
      batch =>
        batch.status === BatchStatus.Active &&
        !!batch.expiresOn &&
        daysUntilExpiry(batch.expiresOn, today) < 0,
    );

  const activeBatches = batches.filter(
    batch => batch.status === BatchStatus.Active,
  );
  const [soleBatch] = activeBatches;
  const soleWeighedBatchId =
    activeBatches.length === 1 && soleBatch?.netWeight != null
      ? soleBatch.id
      : null;

  const discardActions: HeaderAction[] =
    hasExpiredBatches && permissions.canRemoveItems
      ? [
          {
            icon: 'close-circle-outline',
            accessibilityLabel: t('labels.discard'),
            onPress: actions.handleDiscardExpired,
            variant: 'error',
            testID: pantryTestIDs.itemDiscardButton,
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
            onPress: () => {
              void actions.handleAddToShoppingList();
            },
            variant:
              actions.addToListStatus === 'success' ? 'success' : 'primary',
            loading: actions.addToListStatus === 'loading',
            testID: pantryTestIDs.itemAddToListButton,
          } satisfies HeaderAction,
        ]
      : []),
    ...(permissions.canEditItems
      ? ([
          {
            icon: 'swap-vertical-outline',
            accessibilityLabel: t('adjustQuantity.title'),
            onPress: () => actions.setAdjustModalVisible(true),
            testID: pantryTestIDs.itemAdjustButton,
          },
          {
            icon: 'create-outline',
            accessibilityLabel: t('labels.edit'),
            onPress: handleEdit,
            testID: pantryTestIDs.itemEditButton,
          },
          {
            icon: 'camera-outline',
            accessibilityLabel: t('a11y.changePhoto'),
            onPress: () => setPhotoSheetVisible(true),
            testID: catalogTestIDs.entryPhotoChangeButton,
          },
          {
            icon: 'swap-horizontal-outline',
            accessibilityLabel: t('relinkItem.action'),
            onPress: () => setRelinkVisible(true),
            testID: pantryTestIDs.itemRelinkButton,
          },
        ] satisfies HeaderAction[])
      : []),
    ...discardActions,
    ...(permissions.canRemoveItems
      ? ([
          {
            icon: 'trash-outline',
            accessibilityLabel: t('labels.delete'),
            onPress: actions.handleDelete,
            variant: 'error',
            testID: pantryTestIDs.itemDeleteButton,
          },
        ] satisfies HeaderAction[])
      : []),

    ...reportPhoto.actions,
  ];

  return (
    <>
      <CollapsingHeroDetail
        testID={pantryTestIDs.itemDetail}
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
                  leadImageUrl={gallery.leadImageUrl}
                  height={heroHeight}
                  onPhotoPress={setViewerIndex}
                  onPageChange={reportPhoto.onPageChange}
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
              {quantityText}
            </Text>
          }
        />

        {(!!categoryName || !!storageStateDisplay) && (
          <View style={styles.categoryBadge}>
            <Icon name="restaurant-outline" size={16} tone="primary" />
            <Text role="label" style={styles.categoryText}>
              {categoryName ?? t('labels.item')}
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
              <Text role="label" style={styles.infoColumnValue}>
                {formatDaysInPantry(daysInPantry, t)}
              </Text>
            </View>
            <View style={styles.infoColumn}>
              <Text role="caption" style={styles.infoColumnLabel}>
                {t('pantryItemDetail.expiring')}
              </Text>
              <ExpiryColumnText
                text={expiryInfo?.text ?? t('pantryItemDetail.noExpiry')}
                isUrgent={!!expiryInfo?.isUrgent}
                isExpired={!!expiryInfo?.isExpired}
              />
            </View>
            <View style={styles.infoColumn}>
              <Text role="caption" style={styles.infoColumnLabel}>
                {t('pantryItemDetail.amount')}
              </Text>
              <Text role="label" style={styles.infoColumnValue}>
                {quantityText}
              </Text>
            </View>
          </View>
        </DetailSection>

        {!!showNutrition && (
          <DetailSection
            title={
              typicalOf
                ? t('labels.typicalFor', { concept: typicalOf })
                : t('pantryItemDetail.nutrition')
            }
          >
            <NutritionSummary
              nutritionFacts={nutritionFacts}
              showHighlights={!typicalOf}
              onPress={() =>
                toNutritionScreen({
                  itemId: item.id,
                  itemName: item.itemName,
                  nutritionFacts,
                  typicalOf,
                })
              }
            />
          </DetailSection>
        )}

        <DetailSection>
          <PantryDetailInfo
            itemRef={item}
            brandName={brandName}
            quantityText={quantityText}
            netWeightText={netWeightText}
            remainingNetWeightText={remainingNetWeightText}
            quantityBreakdownText={quantityBreakdownText}
            portionsLeftText={portionsLeftText}
            packageBreakdownText={packageBreakdownText}
            shelfLifeDays={item.item.shelfLifeDays}
            shelfLifeOpenedDays={item.item.shelfLifeOpenedDays}
            onCorrectPackageSize={
              soleWeighedBatchId && permissions.canEditItems
                ? () => actions.setCorrectingBatchId(soleWeighedBatchId)
                : undefined
            }
            pricing={batchPricing}
          />
        </DetailSection>

        {batches.length > 1 && (
          <DetailSection flush>
            <BatchSection
              batches={batches}
              unitSymbol={item.unit.symbol}
              netWeightUnitSymbol={item.netWeightUnit?.symbol}
              netWeightUnitId={item.netWeightUnit?.id}
              totalCount={batchTotalCount}
              onViewAll={() =>
                toPantryBatchHistory({
                  pantryItemId: itemId,
                  itemName: item.itemName,
                  unitSymbol: item.unit.symbol,
                })
              }
              onCorrectSize={
                permissions.canEditItems
                  ? actions.setCorrectingBatchId
                  : undefined
              }
            />
          </DetailSection>
        )}

        {item.usageRecordsConnection.edges.length > 0 && (
          <DetailSection>
            <PantryUsageHistory
              usageRecords={item.usageRecordsConnection.edges}
              totalCount={item.usageRecordsConnection.totalCount ?? undefined}
              onViewAll={() =>
                toPantryUsageHistory({
                  pantryItemId: itemId,
                  itemName: item.itemName,
                })
              }
            />
          </DetailSection>
        )}

        <DetailSection title={t('labels.recipesToTry')}>
          {loadingRecipes ? (
            <ThemedActivityIndicator
              size="small"
              style={styles.recipesLoading}
            />
          ) : suggestedRecipes.length > 0 ? (
            <HorizontalRail surface="surface">
              {suggestedRecipes.map(recipe => (
                <AppPressable
                  key={catalogKey(recipe)}
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe)}
                >
                  <CachedImage
                    uri={recipe.imageUrl}
                    style={styles.recipeImage}
                    sharedTransitionTag={`recipe-image-${recipe.providerRecipeId}`}
                  />
                  <Text
                    role="label"
                    style={styles.recipeTitle}
                    numberOfLines={2}
                  >
                    {recipe.name}
                  </Text>
                </AppPressable>
              ))}
            </HorizontalRail>
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
      {!!actions.correctingBatchId && (
        <CorrectPackageSizeModal
          visible
          pantryItemId={itemId}
          batchId={actions.correctingBatchId}
          onClose={() => actions.setCorrectingBatchId(null)}
          onConfirm={actions.handleCorrectPackageSize}
        />
      )}
      {itemPhotos.length > 0 && (
        <ItemPhotoViewer
          visible={viewerIndex !== null}
          photos={itemPhotos}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
          item={item.item}
          entryPhoto={
            permissions.canEditItems
              ? {
                  currentPhotoId: item.image?.catalogImageId ?? null,
                  onUse: photoId => {
                    void entryPhoto.pickItemPhoto(photoId).then(landed => {
                      if (landed) setViewerIndex(null);
                    });
                  },
                }
              : null
          }
        />
      )}
      {!!permissions.canEditItems && (
        <RelinkItemSheet
          visible={relinkVisible}
          onDismiss={() => setRelinkVisible(false)}
          stack={{
            id: item.id,
            version: item.version,
            itemId: item.itemId,
            itemName: item.itemName,
          }}
          onConflictRefresh={handleRefresh}
        />
      )}
      {!!permissions.canEditItems && (
        <EntryPhotoSheet
          visible={photoSheetVisible}
          onDismiss={() => setPhotoSheetVisible(false)}
          entryPhoto={entryPhoto}
          hasHouseholdPhoto={item.image?.source === EntryImageSource.Household}
          onPickItemPhoto={
            pickableIndex >= 0
              ? () => {
                  setPhotoSheetVisible(false);
                  setViewerIndex(pickableIndex);
                }
              : undefined
          }
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
  },
  recipesLoading: {
    marginTop: theme.spacing.sm,
  },
  recipeCard: {
    width: 140,
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
