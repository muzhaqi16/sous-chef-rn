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
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { ClickableInfoPanel } from '#components/molecules/ClickableInfoPanel';
import { NutritionSummary } from '#components/molecules/NutritionSummary';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { FormattedItemSubtitle } from '#components/atoms/FormattedItemSubtitle';
import { commonStyles } from '#/styles/commonStyles';
import { resolveImageUrl, parseImages, hasImages } from '#utils/imageUtils';
import { parseNutritions, hasNutritionData } from '#utils/nutritionUtils';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

type RouteParams = {
  listId: string;
  itemId: string;
};

export const ShoppingListItemDetail: React.FC<
  StaticScreenProps<RouteParams>
> = ({ route }) => {
  const { t } = useTranslation();
  useScreenTransition('ShoppingListItemDetail');
  const { toEditItem, toPurchaseHistory, goBack } = useAppNavigation();
  const { listId, itemId } = route.params;

  // Use cache-first policy - offlineQueryLink will handle offline behavior automatically
  const { data } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId },
    fetchPolicy: 'cache-first',
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
      <DetailTemplate
        title={t('shoppingListScreens.itemDetailsTitle')}
        onBack={() => goBack()}
        headerActions={[]}
        sections={[
          {
            content: (
              <Text style={[commonStyles.body, { textAlign: 'center' }]}>
                {data === undefined
                  ? t('shoppingListScreens.loading')
                  : t('shoppingListScreens.itemNotFound')}
              </Text>
            ),
          },
        ]}
      />
    );
  }

  const imageUrl = resolveImageUrl(item, 'large');

  const sections = [
    {
      content: (
        <View>
          <View style={styles.headerSection}>
            {showImages ? (
              <ImageGalleryTabs
                images={itemImages}
                fallbackImageUrl={imageUrl}
                imageHeight={160}
              />
            ) : imageUrl ? (
              <CachedImage
                uri={imageUrl}
                style={styles.itemImage}
                displaySize={120}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="basket-outline" size={48} tone="textSecondary" />
              </View>
            )}
          </View>
          <Text style={[commonStyles.title, styles.itemName]}>
            {item.itemName}
          </Text>
          {item.quantity != null ? (
            <View style={styles.itemDescription}>
              <FormattedItemSubtitle
                quantity={item.quantity}
                quantityInput={item.quantityInput}
                displayFormat={item.displayFormat}
                unitSymbol={item.unitName || item.item?.displayUnit?.symbol}
              />
            </View>
          ) : null}
          {/* Status Badge */}
          {item.purchaseInfo?.isPurchased ? (
            <View style={styles.statusBadge}>
              <Icon name="checkmark-circle" size={20} tone="success" />
              <Text
                size="md"
                weight="semibold"
                tone="success"
                style={styles.statusBadgeText}
              >
                {t('shoppingListScreens.purchased')}
              </Text>
            </View>
          ) : null}
        </View>
      ),
    },
    {
      title: t('shoppingListScreens.information'),
      content: (
        <View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              {t('shoppingListScreens.quantity')}
            </Text>
            <View>
              <FormattedItemSubtitle
                quantity={item.quantity}
                quantityInput={item.quantityInput}
                displayFormat={item.displayFormat}
                unitSymbol={item.unitName || item.item?.displayUnit?.symbol}
              />
            </View>
          </View>

          {item.category ? (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                {t('shoppingListScreens.category')}
              </Text>
              <Text size="sm" weight="medium">
                {item.category}
              </Text>
            </View>
          ) : null}

          {item.priority ? (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                {t('shoppingListScreens.priority')}
              </Text>
              <Text size="sm" weight="medium">
                {item.priority}
              </Text>
            </View>
          ) : null}

          {item.notes ? (
            <View style={styles.notesRow}>
              <Text style={commonStyles.caption}>
                {t('shoppingListScreens.notes')}
              </Text>
              <Text size="sm" weight="medium">
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>
      ),
    },
  ];

  // Nutrition section (inline display, no navigation for shopping list)
  if (showNutrition) {
    sections.push({
      title: t('dietary.nutritionGoals'),
      content: (
        <NutritionSummary nutritions={itemNutritions} showHighlights compact />
      ),
    });
  }

  // Purchase History section - Clickable panel
  // Extract purchases from paginated connection
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

  sections.push({
    content: (
      <ClickableInfoPanel
        title={t('shoppingListScreens.purchaseHistoryTitle')}
        items={purchaseHistoryItems}
        onPress={handleViewHistory}
        emptyMessage={t('shoppingListScreens.noPurchaseHistory')}
      />
    ),
  });

  // Additional Details section
  sections.push({
    title: t('shoppingListScreens.additionalDetails'),
    content: (
      <View>
        {item.addedBy ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              {t('shoppingListScreens.addedBy')}
            </Text>
            <Text size="sm" weight="medium">
              {item.addedBy.profile?.displayName || item.addedBy.email}
            </Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={[commonStyles.caption, styles.detailLabel]}>
            {t('shoppingListScreens.addedOn')}
          </Text>
          <Text size="sm" weight="medium">
            {formatDate(item.createdAt)}
          </Text>
        </View>

        {item.updatedAt !== item.createdAt ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              {t('shoppingListScreens.lastUpdated')}
            </Text>
            <Text size="sm" weight="medium">
              {formatDate(item.updatedAt)}
            </Text>
          </View>
        ) : null}

        {item.source?.isAutoAdded ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              {t('shoppingListScreens.autoAdded')}
            </Text>
            <Text size="sm" weight="medium">
              {item.source?.autoAddReason || t('shoppingListScreens.yes')}
            </Text>
          </View>
        ) : null}

        {item.source?.isFromMealPlan ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              {t('shoppingListScreens.fromMealPlan')}
            </Text>
            <Text size="sm" weight="medium">
              {t('shoppingListScreens.yes')}
            </Text>
          </View>
        ) : null}
      </View>
    ),
  });

  return (
    <DetailTemplate
      title={t('shoppingListScreens.itemDetailsTitle')}
      onBack={() => goBack()}
      headerActions={[
        {
          icon: 'create-outline',
          onPress: handleEdit,
        },
      ]}
      sections={sections}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  itemImage: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemName: {
    fontSize: theme.fonts.size['2xl'],
    textAlign: 'center',
  },
  itemDescription: {
    marginTop: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.successLight,
    marginTop: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  statusBadgeText: {
    marginLeft: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    flex: 1,
  },
  notesRow: {
    flexDirection: 'column',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
}));
