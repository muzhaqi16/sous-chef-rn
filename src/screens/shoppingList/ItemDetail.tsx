import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useGetShoppingListItemQuery } from '#generated';
import { useAppNavigation } from '#hooks';
import { Icon } from '#utils';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { ClickableInfoPanel } from '#components/molecules/ClickableInfoPanel';
import { commonStyles } from '#styles';

type RouteParams = {
  listId: string;
  itemId: string;
};

export const ShoppingListItemDetail: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { navigate, goBack } = useAppNavigation();
  const { listId, itemId } = route.params;

  const { data } = useGetShoppingListItemQuery({
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  });

  const item = data?.shoppingListItem;

  const handleEdit = () => {
    navigate('EditItem', { listId, itemId });
  };

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

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const sections = [
    {
      content: (
        <View>
          <View style={styles.headerSection}>
            {item.item?.imageUrl ? (
              <Image
                source={{ uri: item.item.imageUrl }}
                style={styles.itemImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="shopping-basket" size={48} color="#999" />
              </View>
            )}
          </View>
          <Text style={[commonStyles.title, styles.itemName]}>
            {item.itemName}
          </Text>
          {item.quantity || item.unitName ? (
            <Text style={[commonStyles.subtitle, styles.itemDescription]}>
              {`${item.quantity || ''} ${item.unitName || ''}`.trim()}
            </Text>
          ) : null}
          {/* Status Badge */}
          {item.isPurchased ? (
            <View style={styles.statusBadge}>
              <Icon name="check-circle" size={20} color="#4CAF50" />
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
            <Text style={styles.detailValue}>
              {`${item.quantity || ''} ${item.unitName || ''}`.trim() || 'N/A'}
            </Text>
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

  // Purchase History section - Clickable panel
  const purchases = item.purchases || [];
  const hasPurchases = purchases.length > 0;

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
          value: purchases.length,
        },
        {
          label: 'Most Recent Purchase',
          value: formatDate(purchases[0].purchaseDate),
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

        {item.isAutoAdded ? (
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Auto-Added
            </Text>
            <Text style={styles.detailValue}>
              {item.autoAddReason || 'Yes'}
            </Text>
          </View>
        ) : null}

        {item.isFromMealPlan ? (
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
          icon: 'edit',
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
    borderRadius: 12,
    marginBottom: theme.spacing.md,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
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
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#E8F5E9',
    marginTop: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  statusBadgeText: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: '#4CAF50',
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
