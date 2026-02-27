import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useGetShoppingListItemQuery } from '#generated';
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

type RouteParams = {
  listId: string;
  itemId: string;
};

export const ShoppingListItemDetail: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  useScreenTransition('ShoppingListItemDetail');
  const { theme } = useUnistyles();
  const { navigate, goBack } = useAppNavigation();
  const { listId, itemId } = route.params;

  // Use cache-first policy - offlineQueryLink will handle offline behavior automatically
  const { data } = useGetShoppingListItemQuery({
    variables: { id: itemId },
    fetchPolicy: 'cache-first',
  });

  const item = data?.shoppingListItem;

  const handleEdit = () => {
    navigate('EditItem', { listId, itemId });
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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
        title="Item Details"
        onBack={() => goBack()}
        headerActions={[]}
        sections={[
          {
            content: (
              <Text style={[commonStyles.body, { textAlign: 'center' }]}>
                {data === undefined ? 'Loading...' : 'Item not found'}
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
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="basket-outline" size={48} color={theme.colors.textSecondary} />
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
              <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={styles.statusBadgeText}>Purchased</Text>
            </View>
          ) : null}
        </View>
      ),
    },
    {
      title: 'Information',
      content: (
        <View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Quantity
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
                Category
              </Text>
              <Text style={styles.detailValue}>{item.category}</Text>
            </View>
          ) : null}

          {item.priority ? (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Priority
              </Text>
              <Text style={styles.detailValue}>{item.priority}</Text>
            </View>
          ) : null}

          {item.notes ? (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Notes
              </Text>
              <Text style={styles.detailValue}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
      ),
    },
  ];

  // Nutrition section (inline display, no navigation for shopping list)
  if (showNutrition) {
    sections.push({
      title: 'Nutrition',
      content: (
        <NutritionSummary nutritions={itemNutritions} showHighlights compact />
      ),
    });
  }

  // Purchase History section - Clickable panel
  // Extract purchases from paginated connection
  const purchases = item.purchasesConnection?.edges?.map(edge => edge.node) || [];
  const purchaseCount = item.purchasesConnection?.totalCount || 0;
  const hasPurchases = purchaseCount > 0;

  const handleViewHistory = () => {
    navigate('PurchaseHistory', {
      itemId: item.id,
      itemName: item.itemName,
      purchases: purchases,
    });
  };

  const purchaseHistoryItems = hasPurchases
    ? [
        {
          label: 'Times Purchased',
          value: purchaseCount,
        },
        {
          label: 'Most Recent Purchase',
          value: purchases[0] ? formatDate(purchases[0].purchaseDate) : 'N/A',
        },
      ]
    : [];

  sections.push({
    content: (
      <ClickableInfoPanel
        title="Purchase History"
        items={purchaseHistoryItems}
        onPress={handleViewHistory}
        emptyMessage="No purchase history available"
      />
    ),
  });

  // Additional Details section
  sections.push({
    title: 'Additional Details',
    content: (
      <View>
        {item.addedBy ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Added By
            </Text>
            <Text style={styles.detailValue}>
              {item.addedBy.profile?.displayName || item.addedBy.email}
            </Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={[commonStyles.caption, styles.detailLabel]}>
            Added On
          </Text>
          <Text style={styles.detailValue}>{formatDate(item.createdAt)}</Text>
        </View>

        {item.updatedAt !== item.createdAt ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Last Updated
            </Text>
            <Text style={styles.detailValue}>{formatDate(item.updatedAt)}</Text>
          </View>
        ) : null}

        {item.source?.isAutoAdded ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Auto-Added
            </Text>
            <Text style={styles.detailValue}>
              {item.source?.autoAddReason || 'Yes'}
            </Text>
          </View>
        ) : null}

        {item.source?.isFromMealPlan ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              From Meal Plan
            </Text>
            <Text style={styles.detailValue}>Yes</Text>
          </View>
        ) : null}
      </View>
    ),
  });

  return (
    <DetailTemplate
      title="Item Details"
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.success,
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
  detailValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
}));
