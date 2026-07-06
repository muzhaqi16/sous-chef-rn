import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { DetailSection } from '#components/molecules/DetailSection';
import { DetailTitleRow } from '#components/molecules/DetailTitleRow';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import Animated from 'react-native-reanimated';
import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import {
  PantryItemDetail_PantryItemFragmentDoc,
  type PantryItemDetail_PantryItemFragment,
} from '#features/pantry/screens/PantryItemDetail.generated';
import { useTranslation } from 'react-i18next';
import {
  GetPantryItemDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
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
import { GalleryHero } from '#components/templates/GalleryHero';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
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
  const selectedShoppingListId = useSelectedShoppingListId();
  const selectedPantryId = useSelectedPantryId();

  const [purchaseHistoryExpanded, setPurchaseHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId },
  });
  const client = useApolloClient();

  // Batches are no longer an inline field on PantryItem — they're a Relay
  // connection. Fetch all of them (no status filter) so the active list AND the
  // "show all inactive" affordance in BatchSection both have their data.
  // `cache-and-network` paints from the persisted cache on cold start and
  // refreshes after a batch is opened/wasted.
  const { data: batchesData } = useQuery(GetPantryItemBatchesDocument, {
    variables: { pantryItemId: itemId },
    fetchPolicy: 'cache-and-network',
  });

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const permissions = usePantryPermissions();

  // Live binding to the PantryItem entity. `livePantryItem.data` gets a fresh
  // reference whenever the entity's PantryItemDetail_pantryItem fields change
  // in the cache (quantity adjust, condition change, etc.). Under
  // `dataMasking: true` the `useQuery` result's `data.pantryItem` is a masked
  // ref whose identity is stable across those changes, so it cannot serve as
  // the reactivity signal on its own.
  const livePantryItem = useFragment({
    fragment: PantryItemDetail_PantryItemFragmentDoc,
    fragmentName: 'PantryItemDetail_pantryItem',
    from: data?.pantryItem ?? null,
  });

  // Materialize the masked PantryItem ref into a fully unmasked entity.
  // `cache.readFragment` returns the unmasked shape (Apollo's signature),
  // inlining nested fragment fields so the screen and downstream components
  // can access them directly.
  //
  // `readFragment` reads the mutable cache during render, so the React Compiler
  // memoizes this derivation against the reactive values referenced here. The
  // `livePantryItem.data` guard is the load-bearing dependency: gating only on
  // the masked `data.pantryItem` (stable across field changes) would pin this
  // read to a stale snapshot until a refetch, so in-place edits (quantity,
  // condition, expiry) wouldn't surface until pull-to-refresh. Referencing
  // `livePantryItem.data` (fresh on every relevant cache write) forces the
  // unmasked read to re-run immediately.
  const item =
    data?.pantryItem && livePantryItem.complete && livePantryItem.data
      ? client.cache.readFragment<PantryItemDetail_PantryItemFragment>({
          fragment: PantryItemDetail_PantryItemFragmentDoc,
          fragmentName: 'PantryItemDetail_pantryItem',
          from: data.pantryItem,
        })
      : null;

  // Connection edges arrive as masked refs — materialize each into the full
  // PantryItemBatchFragment via cache.readFragment so status/expiresAt reads and
  // BatchSection's sort/filter work directly.
  const batches: PantryItemBatchFragment[] =
    batchesData?.pantryItemBatchesConnection?.edges
      ?.map(edge =>
        client.cache.readFragment<PantryItemBatchFragment>({
          fragment: PantryItemBatchFragmentDoc,
          fragmentName: 'PantryItemBatchFragment',
          from: edge.node,
        }),
      )
      .filter((b): b is PantryItemBatchFragment => b != null) ?? [];

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
      <CollapsingHeroDetail onBack={goBack} testID="pantry-item-detail">
        <View style={styles.loadingContainer}>
          <SousChefLoader
            size="small"
            showBrand={false}
            message={t('pantryItemDetail.loading')}
          />
        </View>
      </CollapsingHeroDetail>
    );
  }

  // `batches` are already materialized above — inspect status/expiresAt for the
  // discard-expired affordance.
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
                  images={itemImages}
                  fallbackImageUrl={imageUrl}
                  height={heroHeight}
                />
              )
            : undefined
        }
      >
        <DetailTitleRow
          title={item.itemName}
          numberOfLines={2}
          trailing={
            <Text style={styles.quantityBadge}>
              {item.quantity} {getUnitDisplayText(item.unit)}
            </Text>
          }
        />

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

        <DetailSection>
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
            correctWeightDisabled={actions.correctWeightUnavailable}
          />
        </DetailSection>

        {batches.length > 1 && (
          <DetailSection flush>
            <BatchSection
              batches={batches}
              pantryItemId={item.id}
              unitSymbol={item.unit?.symbol ?? undefined}
            />
          </DetailSection>
        )}

        {!!item.usageRecords && item.usageRecords.edges.length > 0 && (
          <DetailSection flush>
            <PantryUsageHistory
              usageRecords={item.usageRecords.edges}
              expanded={purchaseHistoryExpanded}
              onToggle={() =>
                setPurchaseHistoryExpanded(!purchaseHistoryExpanded)
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
                  <Animated.Image
                    source={{ uri: recipe.image }}
                    style={styles.recipeImage}
                    resizeMode="cover"
                    sharedTransitionTag={`recipe-image-${recipe.id}`}
                  />
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                </AppPressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noRecipes}>
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
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
