import React, {useMemo, useEffect} from 'react';
import {useLazyQuery} from '@apollo/client';
import {GET_ITEMS_FOR_AUTOCOMPLETE} from '../../api/queries';
import {FlatList, Text, TouchableOpacity, StyleSheet} from 'react-native';

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
  const [fetchItems, {data, loading, error}] = useLazyQuery(
    GET_ITEMS_FOR_AUTOCOMPLETE,
  );

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
    if (!data?.itemsAutocomplete) return [];
    return data.itemsAutocomplete.filter((item: Item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [data, searchTerm]);

  // Handle loading and error states.
  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error loading items</Text>;

  // Only render the autocomplete list if searchTerm has at least 2 characters.
  return searchTerm.length < 2 ? null : (
    <FlatList
      data={filteredItems}
      keyExtractor={(item: Item) => item.id}
      renderItem={({item}) => (
        <TouchableOpacity
          onPress={() => onSelectItem(item)}
          style={styles.item}>
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )}
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
