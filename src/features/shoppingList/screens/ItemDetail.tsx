import React from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment, useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemDetail_ShoppingListItemFragmentDoc } from './ItemDetail.generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';
import { ClickableInfoPanel } from '#components/molecules/ClickableInfoPanel';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { resolveImageUrl, parseImages, hasImages } from '#utils/imageUtils';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { DetailSection } from '#components/molecules/DetailSection';

type RouteParams = {
  listId: string;
  itemId: string;
};

/** Label/value row used inside the detail cards. */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <View style={styles.detailRow}>
    <Text size="sm" tone="secondary" style={styles.detailLabel}>
      {label}
    </Text>
    {children}
  </View>
);

export const ShoppingListItemDetail: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('ShoppingListItemDetail');
  const { toEditItem, toPurchaseHistory, goBack } = useAppNavigation();
  const { listId, itemId } = route.params;

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
    if (!dateString) return t('shoppingListScreens.never');
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Images and nutrition from catalog item
  // Must be called before early return to follow rules of hooks
  const itemImages = parseImages(item?.item?.images);
  const itemNutritions = parseNutritions(item?.item?.nutritions);
  const showImages = hasImages(itemImages);
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
              : t('shoppingListScreens.itemNotFound')}
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
  const hasHero = showImages || !!largeImageUrl;

  // Purchase History - extract purchases from paginated connection
  const purchases =
    item.purchasesConnection?.edges?.map(edge => edge.node) || [];
  const purchaseCount = item.purchasesConnection?.totalCount || 0;
  const hasPurchases = purchaseCount > 0;

  const handleViewHistory = () => {
    toPurchaseHistory({
      itemId: item.id,
      itemName: item.itemName ?? '',
      purchases: purchases,
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
          value: purchases[0] ? formatDate(purchases[0].purchaseDate) : 'N/A',
        },
      ]
    : [];

  const unitSymbol = item.unitName || item.item?.displayUnit?.symbol;

  return (
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
                <ImageGalleryTabs
                  images={itemImages}
                  fallbackImageUrl={imageUrl}
                  imageHeight={heroHeight}
                  resizeMode="cover"
                  style={styles.heroInner}
                />
              ) : (
                <CachedImage
                  uri={imageUrl ?? ''}
                  style={[styles.heroFull, { height: heroHeight }]}
                  displaySize={heroHeight}
                  resizeMode="cover"
                />
              )
          : undefined
      }
    >
      <View style={styles.titleRow}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.itemName}
        </Text>
        {item.quantity != null && (
          <FormattedItemSubtitle
            quantity={item.quantity}
            quantityInput={item.quantityInput}
            displayFormat={item.displayFormat}
            unitSymbol={unitSymbol}
          />
        )}
      </View>

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

      <DetailSection
        style={styles.sectionSpacing}
        title={t('shoppingListScreens.information')}
      >
        <DetailRow label={t('shoppingListScreens.quantity')}>
          <FormattedItemSubtitle
            quantity={item.quantity}
            quantityInput={item.quantityInput}
            displayFormat={item.displayFormat}
            unitSymbol={unitSymbol}
          />
        </DetailRow>
        {!!item.category && (
          <DetailRow label={t('shoppingListScreens.category')}>
            <Text size="sm" weight="medium">
              {item.category}
            </Text>
          </DetailRow>
        )}
        {!!item.priority && (
          <DetailRow label={t('shoppingListScreens.priority')}>
            <Text size="sm" weight="medium">
              {item.priority}
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
        <DetailSection
          style={styles.sectionSpacing}
          title={t('dietary.nutritionGoals')}
        >
          <NutritionSummary
            nutritions={itemNutritions}
            showHighlights
            compact
          />
        </DetailSection>
      )}

      <DetailSection style={styles.sectionSpacing}>
        <ClickableInfoPanel
          title={t('shoppingListScreens.purchaseHistoryTitle')}
          items={purchaseHistoryItems}
          onPress={handleViewHistory}
          emptyMessage={t('shoppingListScreens.noPurchaseHistory')}
        />
      </DetailSection>

      <DetailSection
        style={styles.sectionSpacing}
        title={t('shoppingListScreens.additionalDetails')}
      >
        {!!item.addedBy && (
          <DetailRow label={t('shoppingListScreens.addedBy')}>
            <Text size="sm" weight="medium">
              {item.addedBy.profile?.displayName || item.addedBy.email}
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
              {item.source?.autoAddReason || t('shoppingListScreens.yes')}
            </Text>
          </DetailRow>
        )}
        {!!item.source?.isFromMealPlan && (
          <DetailRow label={t('shoppingListScreens.fromMealPlan')}>
            <Text size="sm" weight="medium">
              {t('shoppingListScreens.yes')}
            </Text>
          </DetailRow>
        )}
      </DetailSection>
    </CollapsingHeroDetail>
  );
};

const styles = StyleSheet.create(theme => ({
  heroInner: {
    borderRadius: 0,
  },
  heroFull: {
    width: '100%',
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: theme.fonts.size['2xl'],
    // Explicit line height so bold descenders (g, p, y) aren't clipped on
    // Android, where an unset lineHeight on a large bold Text crops the glyph box.
    lineHeight: theme.typography.lineHeight.loose,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.successLight,
    borderRadius: theme.radii.md,
  },
  statusBadgeText: {
    marginLeft: theme.spacing.xs,
  },
  sectionSpacing: {
    marginTop: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  detailLabel: {
    flex: 1,
  },
  notesRow: {
    flexDirection: 'column',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
}));
