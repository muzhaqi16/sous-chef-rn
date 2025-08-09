import React, {useState} from 'react';
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {SwipeablePantryItem} from '../components/organisms/SwipeablePantryItem';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import SearchBar from '../components/molecules/SearchBar';
import {usePantryItems} from '../hooks';
import {useUserData} from '../hooks/useUserData';
import {StorageState, useHomeQuery} from '../graphql/generated';
import {UserHeader} from '../components/molecules/UserHeader';
import {useNavigation} from '@react-navigation/native';
import {RootNavProp} from '../navigation';
import Icon from '@react-native-vector-icons/material-icons';

export const MainScreen: React.FC = () => {
  const {styles} = useStyles(stylesheet);
  const navigation = useNavigation<RootNavProp>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expiredCount, setExpiredCount] = useState(0);
  const {user} = useUserData(); // Only uses auth data

  const {data: homeData} = useHomeQuery({
    fetchPolicy: 'cache-and-network',
    variables: {homeId: ''},
    skip: !user?.id,
  });

  const pantryId = homeData?.home?.defaultPantry?.id;
  const {items, query, setQuery, refetch} = usePantryItems(pantryId);

  const handleScanBarcode = () => {
    navigation.navigate('BarcodeStack', {
      screen: 'BarcodeScanner',
    });
  };

  return (
    <View style={styles.container}>
      <UserHeader />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Find an item…"
      />
      <ScrollView
        contentContainerStyle={styles.listContent}
        StickyHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={{fontSize: 16, fontWeight: 'bold'}}>
              Expired Items: {expiredCount}
            </Text>
          </View>
        )}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setIsRefreshing(true);
              refetch().finally(() => setIsRefreshing(false));
            }}
            refreshing={isRefreshing}
          />
        }>
        {items.map(pantryItem => {
          if (
            pantryItem.expiresAt &&
            new Date(pantryItem.expiresAt) < new Date()
          ) {
            setExpiredCount(prevCount => prevCount + 1);
          }
          return (
            <SwipeablePantryItem
              key={pantryItem.id}
              item={{
                id: pantryItem.id,
                itemName: pantryItem.item.name,
                quantity: `${pantryItem.quantity} ${pantryItem.unit.symbol}`,
                location:
                  pantryItem.storageState === StorageState.Frozen
                    ? 'Frozen'
                    : pantryItem.storageState === StorageState.Refrigerated
                      ? 'Refrigerated'
                      : 'Pantry',
                expirationText: pantryItem.expiresAt
                  ? `Expiring on ${new Date(pantryItem.expiresAt).toLocaleDateString()}`
                  : 'No expiration',
                icon: {uri: 'default_icon.png'},
              }}
              onDelete={() => () => {}}
              onEdit={() => {}}
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
  listContent: {
    paddingBottom: theme.spacing.sm + 80, // Add bottom padding to account for FAB
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#62B1F6',
    elevation: 8, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  fabText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
}));
