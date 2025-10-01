import React, {useEffect} from 'react';
import {View, Text, ScrollView, TouchableOpacity, Image} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useGetShoppingListItemQuery} from '#generated';
import {useAppNavigation} from '#hooks';
import {Icon} from '#utils';
import {Header} from '#components/molecules/Header';
import {useTabBarVisibility} from '#/context/TabBarVisibilityContext';

type RouteParams = {
  listId: string;
  itemId: string;
};

export const ShoppingListItemDetail: React.FC<{
  route: {params: RouteParams};
}> = ({route}) => {
  const {navigate, goBack} = useAppNavigation();
  const {listId, itemId} = route.params;
  const {hideTabBar, showTabBar} = useTabBarVisibility();

  const {data, loading} = useGetShoppingListItemQuery({
    variables: {id: itemId},
    fetchPolicy: 'cache-and-network',
  });

  const item = data?.shoppingListItem;

  // Hide tab bar when component mounts
  useEffect(() => {
    hideTabBar('navigation');
    hideTabBar('scroll');

    // Show tab bar when component unmounts
    return () => {
      showTabBar('navigation');
      showTabBar('scroll');
    };
  }, [hideTabBar, showTabBar]);

  const handleEdit = () => {
    navigate('EditItem', {listId, itemId});
  };

  if (loading && !item) {
    return (
      <View style={styles.container}>
        <Header
          title="Item Details"
          onBack={() => goBack()}
          rightActions={[]}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <Header
          title="Item Details"
          onBack={() => goBack()}
          rightActions={[]}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Item not found</Text>
        </View>
      </View>
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

  const formatPrice = (price?: number | null) => {
    if (!price) return 'N/A';
    return `$${price.toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Item Details"
        onBack={() => goBack()}
        rightActions={[
          {
            icon: 'edit',
            onPress: handleEdit,
          },
        ]}
      />

      <ScrollView style={styles.scrollView}>
        {/* Item Image and Name */}
        <View style={styles.headerSection}>
          {item.item?.imageUrl ? (
            <Image
              source={{uri: item.item.imageUrl}}
              style={styles.itemImage}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="shopping-basket" size={48} color="#999" />
            </View>
          )}
          <Text style={styles.itemName}>{item.itemName}</Text>
          {(item.quantity || item.unitName) && (
            <Text style={styles.itemDescription}>
              {`${item.quantity || ''} ${item.unitName || ''}`.trim()}
            </Text>
          )}
        </View>

        {/* Status Badge */}
        {item.isPurchased && (
          <View style={styles.statusBadge}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.statusBadgeText}>Purchased</Text>
          </View>
        )}

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quantity</Text>
            <Text style={styles.infoValue}>
              {`${item.quantity || ''} ${item.unitName || ''}`.trim()}
            </Text>
          </View>

          {item.category && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{item.category}</Text>
            </View>
          )}

          {item.priority && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Priority</Text>
              <Text style={styles.infoValue}>{item.priority}</Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.infoValue}>{item.notes}</Text>
            </View>
          )}

          {item.aisle && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Aisle</Text>
              <Text style={styles.infoValue}>{item.aisle}</Text>
            </View>
          )}
        </View>

        {/* Price Information */}
        {(item.estimatedPrice !== undefined && item.estimatedPrice !== null ||
          item.lastKnownPrice !== undefined && item.lastKnownPrice !== null ||
          item.lowestPrice !== undefined && item.lowestPrice !== null ||
          item.highestPrice !== undefined && item.highestPrice !== null ||
          item.purchasedPrice !== undefined && item.purchasedPrice !== null) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>

            {item.estimatedPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estimated Price</Text>
                <Text style={styles.infoValue}>
                  {formatPrice(item.estimatedPrice)}
                </Text>
              </View>
            )}

            {item.lastKnownPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Known Price</Text>
                <Text style={styles.infoValue}>
                  {formatPrice(item.lastKnownPrice)}
                </Text>
              </View>
            )}

            {item.lowestPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Lowest Price</Text>
                <Text style={styles.infoValue}>
                  {formatPrice(item.lowestPrice)}
                </Text>
              </View>
            )}

            {item.highestPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Highest Price</Text>
                <Text style={styles.infoValue}>
                  {formatPrice(item.highestPrice)}
                </Text>
              </View>
            )}

            {item.purchasedPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Purchased Price</Text>
                <Text style={styles.infoPriceValue}>
                  {formatPrice(item.purchasedPrice)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Purchase History */}
        {(item.purchaseDate !== undefined && item.purchaseDate !== null ||
          item.lastPurchaseDate !== undefined && item.lastPurchaseDate !== null ||
          item.purchaseCount !== undefined && item.purchaseCount !== null ||
          item.purchasedBy !== undefined && item.purchasedBy !== null ||
          item.purchasedQuantity !== undefined && item.purchasedQuantity !== null) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Purchase History</Text>

            {item.purchaseDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Purchase Date</Text>
                <Text style={styles.infoValue}>
                  {formatDate(item.purchaseDate)}
                </Text>
              </View>
            )}

            {item.lastPurchaseDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Previous Purchase</Text>
                <Text style={styles.infoValue}>
                  {formatDate(item.lastPurchaseDate)}
                </Text>
              </View>
            )}

            {(item.purchaseCount !== undefined && item.purchaseCount !== null) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Times Purchased</Text>
                <Text style={styles.infoValue}>{item.purchaseCount}</Text>
              </View>
            )}

            {item.purchasedBy && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Purchased By</Text>
                <Text style={styles.infoValue}>
                  {item.purchasedBy.profile?.displayName ||
                    item.purchasedBy.email}
                </Text>
              </View>
            )}

            {item.purchasedQuantity && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Purchased Quantity</Text>
                <Text style={styles.infoValue}>
                  {`${item.purchasedQuantity || ''} ${item.unitName || ''}`.trim()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Additional Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>

          {item.addedBy && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Added By</Text>
              <Text style={styles.infoValue}>
                {item.addedBy.profile?.displayName || item.addedBy.email}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Added On</Text>
            <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
          </View>

          {item.updatedAt !== item.createdAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>
                {formatDate(item.updatedAt)}
              </Text>
            </View>
          )}

          {item.isAutoAdded && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Auto-Added</Text>
              <Text style={styles.infoValue}>
                {item.autoAddReason || 'Yes'}
              </Text>
            </View>
          )}

          {item.isFromMealPlan && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From Meal Plan</Text>
              <Text style={styles.infoValue}>Yes</Text>
            </View>
          )}
        </View>

        {/* Edit Button */}
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Icon name="edit" size={20} color="white" />
          <Text style={styles.editButtonText}>Edit Item</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: theme.fonts.size.md,
    color: '#FF3B30',
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    fontSize: theme.fonts.size.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  itemDescription: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#E8F5E9',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  statusBadgeText: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: theme.spacing.xs,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoPriceValue: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  editButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: 'white',
    marginLeft: theme.spacing.sm,
  },
}));
