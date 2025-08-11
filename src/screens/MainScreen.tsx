import React, {useState, useMemo} from 'react';
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {SearchBar, UserHeader, SwipeablePantryItem} from '#components';
import {usePantryItems, useDefaultHome} from '#hooks';
import {useHomeQuery} from '#generated';
import {RootNavProp} from '../navigation';

export const MainScreen: React.FC = () => {
  const {styles} = useStyles(stylesheet);
  const navigation = useNavigation<RootNavProp>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the new hook to handle default home selection
  const {
    selectedHomeId,
    loading: homesLoading,
    getDefaultPantryId,
  } = useDefaultHome();

  const {data: homeData} = useHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    fetchPolicy: 'cache-and-network',
    skip: !selectedHomeId,
  });

  // Get default pantryId from homeData
  const pantryId = getDefaultPantryId(homeData);

  const {items, query, setQuery, refetch} = usePantryItems(pantryId);

  // Calculate expired count using useMemo to avoid re-renders
  const expiredCount = useMemo(() => {
    if (!items) return 0;

    return items.filter(pantryItem => {
      if (!pantryItem.expiresAt) return false;
      return new Date(pantryItem.expiresAt) < new Date();
    }).length;
  }, [items]);

  const handleScanBarcode = () => {
    navigation.navigate('BarcodeStack', {
      screen: 'BarcodeScanner',
    });
  };

  // Show loading state while selecting default home
  if (homesLoading || !selectedHomeId) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <UserHeader />
        <Text style={styles.loadingText}>Loading your home...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UserHeader />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Find an item…"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setIsRefreshing(true);
              refetch().finally(() => setIsRefreshing(false));
            }}
            refreshing={isRefreshing}
          />
        }>
        {/* Pantry Items */}
        {items?.map(pantryItem => {
          const itemProp = {
            id: pantryItem.id,
            itemName: pantryItem.item?.name,
            quantity: `${pantryItem.initialQuantity} ${pantryItem.unit?.symbol}`,
            location:
              pantryItem.storageState === 'FROZEN'
                ? 'Frozen'
                : pantryItem.storageState === 'REFRIGERATED'
                  ? 'Refrigerated'
                  : 'Pantry',
            expirationText: pantryItem.expiresAt
              ? `Expiring on ${new Date(pantryItem.expiresAt).toLocaleDateString()}`
              : 'No expiration',
            icon: {uri: 'default_icon.png'},
          };

          return (
            <SwipeablePantryItem
              key={pantryItem.id}
              item={itemProp}
              onDelete={id => {
                console.log('Delete pressed for:', id);
                // Add your delete logic here
              }}
              onEdit={id => {
                console.log('Edit pressed for:', id);
                // Add your edit logic here
              }}
            />
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleScanBarcode}>
        <Icon name="qr-code-scanner" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.spacing.sm + 80,
  },
  header: {
    padding: theme.spacing.md,
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border || '#E0E0E0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#62B1F6',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
