import React, {useMemo, useEffect} from 'react';
import {Text, TouchableOpacity, StyleSheet} from 'react-native';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {useAutocompleteItemsLazyQuery} from '../../graphql/generated';
interface Item {
  id: string;
  name: string;
}

interface AutocompleteProps {
  searchTerm: string;
  onSelectItem: (item: Item) => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  searchTerm,
  onSelectItem,
}) => {
  const [fetchItems, {data, loading, error}] = useAutocompleteItemsLazyQuery({
    variables: {name: searchTerm},
    fetchPolicy: 'cache-and-network', // Ensures fresh data is fetched
  });

  // Only run the query when the searchTerm is at least 2 characters long.
  useEffect(() => {
    if (searchTerm.length >= 2) {
      fetchItems({variables: {name: searchTerm}});
    }
  }, [searchTerm, fetchItems]);

  // Always compute filteredItems so that hooks are called in the same order.
  const filteredItems = useMemo(() => {
    // If searchTerm is less than 2 characters, return an empty array.
    if (searchTerm.length < 2) return [];
    if (!data?.autocompleteItems) return [];
    return data.autocompleteItems.filter((item: Item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [data, searchTerm]);

  if (error) return <Text>Error loading items</Text>;

  // Only render the autocomplete list if searchTerm has at least 2 characters.
  return searchTerm.length < 2 ? null : (
    <BottomSheetFlatList
      style={{flex: 1}}
      keyboardDismissMode="on-drag"
      data={filteredItems}
      keyExtractor={(item: Item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({item}) => (
        <TouchableOpacity
          onPress={() => onSelectItem(item)}
          style={styles.item}>
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={{padding: 10, color: 'gray'}}>No items found</Text>
      }
      ListFooterComponent={
        loading ? <Text style={{padding: 10}}>Loading...</Text> : null
      }
    />
  );
};

const styles = StyleSheet.create({
  item: {
    padding: 10,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
});

export default Autocomplete;
