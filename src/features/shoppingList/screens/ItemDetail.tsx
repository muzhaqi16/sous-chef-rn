import React, { useState } from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { formatNetWeightDisplay } from '#features/pantry/hooks/usePantryItemTransformation';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemDetail_ShoppingListItemFragmentDoc } from './ItemDetail.generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import { ClickableInfoPanel } from '#components/molecules/ClickableInfoPanel';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import { GalleryHero } from '#features/catalog/ui/GalleryHero';
import { ItemPhotoViewer } from '#features/catalog/ui/ItemPhotoViewer/ItemPhotoViewer';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { resolveImageUrl, galleryPhotos } from '#utils/imageUtils';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { DetailSection } from '#components/molecules/DetailSection';
import { InfoRow } from '#components/molecules/InfoRow';
import { DetailTitleRow } from '#components/molecules/DetailTitleRow';
import {
  PRIORITY_OPTION_BY_VALUE,
  priorityLabelKey,
} from '#features/shoppingList/utils/priority';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';

type RouteParams = {
  listId: string;
  itemId: string;
};

/** InfoRow preset for the detail cards — the same treatment PantryDetailInfo
 *  uses (secondary label, md vertical padding, divider, no colon), so the
 *  two item-detail screens render label/value rows identically. */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <InfoRow
    label={label}
    value={null}
    showColon={false}
    labelStyle={styles.detailLabel}
    containerStyle={styles.detailRow}
  >
    {children}
  </InfoRow>
);

export const ShoppingListItemDetail: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('ShoppingListItemDetail');
  const { toEditItem, toPurchaseHistory, goBack } = useAppNavigation();
  const { listId, itemId } = route.params;

  // Honor the user's "show shopping list images" setting. When off, the hero is
  // dropped everywhere images are optional — see AppSettingsScreen.
  const showShoppingListImages = useShowShoppingListImages();

  // Collapse the hero if its image fails to load (broken/unreachable URL) so the
  // screen falls back to a clean no-hero header instead of a broken-image
  // placeholder. Keyed by URI so it resets automatically for a different image.
  const [failedHeroUri, setFailedHeroUri] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // cache-and-network: the detail selects fields the list never caches
  // (createdAt, priority, source, addedBy, purchase history, nutrition,
  // displayUnit), so it must hit the network to fill them. cache-first would
  // skip the fetch whenever a partial entity already looks "complete" and leave
  // the screen blank. When the API is unavailable, offlineModeLink still serves
  // this from cache automatically.
  const { data } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  });

  // The detail screen owns its own narrow fragment. useFragment subscribes
  // to the entity record so edits made elsewhere (e.g., AddEditItem) refresh
  // this detail view automatically.
  const itemRef = data?.shoppingListItem ?? null;
  const itemFragmentResult = useFragment({
    fragment: ItemDetail_ShoppingListItemFragmentDoc,
    fragmentName: 'ItemDetail_shoppingListItem',
    from: itemRef,
  });
  const item =
    itemRef && itemFragmentResult.complete ? itemFragmentResult.data : null;

  const handleEdit = () => {
    toEditItem({ listId, itemId });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t('labels.never');
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Images and nutrition from catalog item
  // Must be called before early return to follow rules of hooks
  // The shared formatter, not a local template: it upscales g→kg and ml→L, so a
  // 1500 g package reads the same here as it does in the pantry.
  const netWeightDisplay = formatNetWeightDisplay(
    item?.netWeight,
    item?.netWeightUnit,
  );

  const itemPhotos = galleryPhotos(item?.item?.photos);
  const itemNutritions = parseNutritions(item?.item?.nutritions);
  const showImages = itemPhotos.length > 0;
  const showNutrition = hasNutritionData(itemNutritions);

  if (!item) {
    return (
      <CollapsingHeroDetail
        testID="shopping-item-detail"
        onBack={() => goBack()}
        title={t('shoppingListScreens.itemDetailsTitle')}
      >
        <View style={styles.centerMessage}>
          <Text style={styles.centerMessageText}>
            {data === undefined
              ? t('shoppingListScreens.loading')
              : t('errors.itemNotFound')}
          </Text>
        </View>
      </CollapsingHeroDetail>
    );
  }

  // SIZE_512 is the minimum acceptable resolution for a full-height hero.
  // Thumbnails are excluded from hasHero to avoid stretching a ~100px image
  // to 280px; the fallback is kept only as a CachedImage uri guard.
  const largeImageUrl = resolveImageUrl(item, 'large');
  const imageUrl = largeImageUrl ?? resolveImageUrl(item);
  // Images are optional for shopping items: only show the hero when the user
  // hasn't disabled images, a usable image actually resolves, and it didn't
  // fail to load. Otherwise CollapsingHeroDetail renders a plain solid header.
  const heroFailed = !!imageUrl && failedHeroUri === imageUrl;
  const hasHero =
    showShoppingListImages && (showImages || !!largeImageUrl) && !heroFailed;

  // Purchase History — the lightweight summary (count / last date); the full
  // list is fetched on demand by the PurchaseHistory screen.
  const purchaseHistory = item.purchaseHistory;
  const purchaseCount = purchaseHistory?.purchaseCount ?? 0;
  const hasPurchases = purchaseHistory?.previouslyPurchased ?? false;

  const handleViewHistory = () => {
    toPurchaseHistory({
      itemId: item.id,
      itemName: item.itemName ?? '',
    });
  };

  const purchaseHistoryItems = hasPurchases
    ? [
        {
          label: t('shoppingListScreens.timesPurchased'),
          value: purchaseCount,
        },
        {
          label: t('shoppingListScreens.mostRecentPurchase'),
          value: purchaseHistory?.lastPurchaseDate
            ? formatDate(purchaseHistory.lastPurchaseDate)
            : 'N/A',
        },
      ]
    : [];

  const unitSymbol = item.unitName || item.item?.displayUnit?.symbol;

  // Priority is stored as an Int (0 low, 1 medium, 2 high); map it back to the
  // localized label so the detail matches the form's segmented control instead
  // of showing the raw number.
  const priorityOption = PRIORITY_OPTION_BY_VALUE[item.priority];
  const priorityLabel = priorityOption
    ? t(priorityLabelKey(priorityOption))
    : null;

  const estimatedPrice = item.priceEstimate?.estimated;
  const preferredStoreName = item.storeInfo?.preferredStore?.name;

  return (
    <>
      <CollapsingHeroDetail
        testID="shopping-item-detail"
        onBack={() => goBack()}
        title={item.itemName ?? ''}
        actions={[
          {
            icon: 'create-outline',
            onPress: handleEdit,
            testID: 'shopping-item-edit-button',
          },
        ]}
        renderHero={
          hasHero
            ? heroHeight =>
                showImages ? (
                  <GalleryHero
                    photos={itemPhotos}
                    fallbackImageUrl={imageUrl}
                    height={heroHeight}
                    onPhotoPress={setViewerIndex}
                    // Re-arms the collapse guard on the gallery branch: before
                    // photos existed every item took the CachedImage path below,
                    // so a dead CDN url always collapsed the hero rather than
                    // leaving a 280pt placeholder band.
                    onUnrenderable={() => setFailedHeroUri(imageUrl)}
                  />
                ) : (
                  <CachedImage
                    testID="shopping-item-hero-image"
                    uri={imageUrl ?? ''}
                    style={[styles.heroFull, { height: heroHeight }]}
                    displaySize={heroHeight}
                    resizeMode="cover"
                    onError={() => setFailedHeroUri(imageUrl)}
                  />
                )
            : undefined
        }
      >
        <DetailTitleRow
          title={item.itemName ?? ''}
          numberOfLines={2}
          style={styles.titleRow}
        />

        {!!item.purchaseInfo?.isPurchased && (
          <View style={styles.statusBadge}>
            <Icon name="checkmark-circle" size={18} tone="success" />
            <Text
              size="sm"
              weight="semibold"
              tone="success"
              style={styles.statusBadgeText}
            >
              {t('shoppingListScreens.purchased')}
            </Text>
          </View>
        )}

        <DetailSection title={t('labels.information')}>
          <DetailRow label={t('labels.quantity')}>
            <FormattedItemSubtitle
              quantity={item.quantity}
              quantityInput={item.quantityInput}
              displayFormat={item.displayFormat}
              unitSymbol={unitSymbol}
            />
          </DetailRow>
          {!!item.category && (
            <DetailRow label={t('labels.category')}>
              <Text size="sm" weight="medium">
                {item.category}
              </Text>
            </DetailRow>
          )}
          {!!item.brand?.name && (
            <DetailRow label={t('labels.brand')}>
              <Text size="sm" weight="medium">
                {item.brand.name}
              </Text>
            </DetailRow>
          )}
          {!!netWeightDisplay && (
            <DetailRow label={t('labels.netWeight')}>
              <Text size="sm" weight="medium">
                {netWeightDisplay}
              </Text>
            </DetailRow>
          )}
          {estimatedPrice != null && (
            <DetailRow label={t('shoppingListScreens.estimatedPrice')}>
              <Text size="sm" weight="medium">
                {formatCurrency(estimatedPrice, DEFAULT_CURRENCY)}
              </Text>
            </DetailRow>
          )}
          {!!item.purchaseInfo?.isPurchased &&
            item.purchaseInfo.purchasedQuantity != null && (
              <DetailRow label={t('shoppingListScreens.purchased')}>
                <Text size="sm" weight="medium">
                  {item.purchaseInfo.purchasedPrice != null
                    ? `${
                        item.purchaseInfo.purchasedQuantity
                      } @ ${formatCurrency(
                        item.purchaseInfo.purchasedPrice,
                        DEFAULT_CURRENCY,
                      )}`
                    : `${item.purchaseInfo.purchasedQuantity}`}
                </Text>
              </DetailRow>
            )}
          {!!item.purchaseInfo?.isPurchased &&
            !!item.purchaseInfo.purchasedBy && (
              <DetailRow label={t('shoppingListScreens.purchasedBy')}>
                <Text size="sm" weight="medium">
                  {item.purchaseInfo.purchasedBy.profile?.displayName ||
                    t('labels.someone')}
                </Text>
              </DetailRow>
            )}
          {!!priorityLabel && (
            <DetailRow label={t('shoppingListScreens.priority')}>
              <Text size="sm" weight="medium">
                {priorityLabel}
              </Text>
            </DetailRow>
          )}
          {!!preferredStoreName && (
            <DetailRow label={t('shoppingListScreens.store')}>
              <Text size="sm" weight="medium">
                {preferredStoreName}
              </Text>
            </DetailRow>
          )}
          {!!item.notes && (
            <View style={styles.notesRow}>
              <Text size="sm" tone="secondary">
                {t('shoppingListScreens.notes')}
              </Text>
              <Text size="sm" weight="medium">
                {item.notes}
              </Text>
            </View>
          )}
        </DetailSection>

        {!!showNutrition && (
          <DetailSection title={t('dietary.nutritionGoals')}>
            <NutritionSummary
              nutritions={itemNutritions}
              showHighlights
              compact
            />
          </DetailSection>
        )}

        <DetailSection>
          <ClickableInfoPanel
            title={t('labels.purchaseHistory')}
            items={purchaseHistoryItems}
            onPress={handleViewHistory}
            emptyMessage={t('shoppingListScreens.noPurchaseHistory')}
          />
        </DetailSection>

        <DetailSection title={t('shoppingListScreens.additionalDetails')}>
          {!!item.addedBy && (
            <DetailRow label={t('shoppingListScreens.addedBy')}>
              <Text size="sm" weight="medium">
                {item.addedBy.profile?.displayName ||
                  item.addedBy.email ||
                  t('labels.someone')}
              </Text>
            </DetailRow>
          )}
          {!!item.lastEditedBy?.profile?.displayName &&
            item.lastEditedBy.id !== item.addedBy?.id && (
              <DetailRow label={t('shoppingListScreens.lastEditedBy')}>
                <Text size="sm" weight="medium">
                  {item.lastEditedBy.profile.displayName}
                </Text>
              </DetailRow>
            )}
          <DetailRow label={t('shoppingListScreens.addedOn')}>
            <Text size="sm" weight="medium">
              {formatDate(item.createdAt)}
            </Text>
          </DetailRow>
          {item.updatedAt !== item.createdAt && (
            <DetailRow label={t('shoppingListScreens.lastUpdated')}>
              <Text size="sm" weight="medium">
                {formatDate(item.updatedAt)}
              </Text>
            </DetailRow>
          )}
          {!!item.source?.isAutoAdded && (
            <DetailRow label={t('shoppingListScreens.autoAdded')}>
              <Text size="sm" weight="medium">
                {item.source?.autoAddReason || t('labels.yes')}
              </Text>
            </DetailRow>
          )}
          {!!item.source?.isFromMealPlan && (
            <DetailRow label={t('shoppingListScreens.fromMealPlan')}>
              <Text size="sm" weight="medium">
                {t('labels.yes')}
              </Text>
            </DetailRow>
          )}
        </DetailSection>
      </CollapsingHeroDetail>
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
  heroFull: {
    width: '100%',
  },
  // Breathing room between the item name and the first detail card; without it
  // the title sits flush against the "Information" section.
  titleRow: {
    marginBottom: theme.spacing.md,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  centerMessageText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    // Separate the badge from the Information card below it; the card has no
    // top margin of its own, so without this the badge sits flush against it.
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.successLight,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  statusBadgeText: {
    marginLeft: theme.spacing.xs,
  },
  // Overrides on top of InfoRow's defaults (border/structure come from there).
  detailRow: {
    paddingVertical: theme.spacing.md,
  },
  detailLabel: {
    color: theme.colors.textSecondary,
  },
  notesRow: {
    flexDirection: 'column',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
}));
