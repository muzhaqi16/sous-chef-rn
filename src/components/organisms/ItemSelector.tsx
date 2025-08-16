import React from 'react';
import {
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  View,
} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

// Generic interface for selectable items
interface SelectableItem {
  id: string;
  [key: string]: any;
}

interface ItemSelectorProps<T extends SelectableItem> {
  data: T[];
  selectedId?: string;
  onSelect: (id: string, item: T) => void;
  displayProperty: keyof T; // which property to display as the item name
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T) => string;
  renderCustomItem?: (
    item: T,
    isSelected: boolean,
    onPress: () => void,
  ) => React.ReactElement;
}

export function ItemSelector<T extends SelectableItem>({
  data,
  selectedId,
  onSelect,
  displayProperty,
  loading = false,
  emptyMessage = 'No items available',
  keyExtractor,
  renderCustomItem,
}: ItemSelectorProps<T>) {
  const {styles, theme} = useStyles(stylesheet);

  const defaultKeyExtractor = (item: T) => item.id;
  const getKey = keyExtractor || defaultKeyExtractor;

  const handleItemSelect = (item: T) => {
    onSelect(item.id, item);
  };

  const renderItem = ({item}: {item: T}) => {
    const isSelected = item.id === selectedId;

    if (renderCustomItem) {
      return renderCustomItem(item, isSelected, () => handleItemSelect(item));
    }

    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.selectedItem]}
        onPress={() => handleItemSelect(item)}>
        <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
          {String(item[displayProperty])}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={getKey}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{}}
      style={{flexGrow: 0}}
      ItemSeparatorComponent={() => <View style={{height: 8}} />}
    />
  );
}

const stylesheet = createStyleSheet(theme => ({
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  itemText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  selectedItemText: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));

export default ItemSelector;
