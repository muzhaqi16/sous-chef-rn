import React, {useCallback, useMemo, memo} from 'react';
import {
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  View,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

// Memoized separator component to prevent re-renders
const ItemSeparator = memo(() => <View style={separatorStyle} />);
ItemSeparator.displayName = 'ItemSeparator';

const separatorStyle = {height: 8};

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
  const {theme} = useUnistyles();

  const defaultKeyExtractor = useCallback((item: T) => item.id, []);
  const getKey = keyExtractor || defaultKeyExtractor;

  const handleItemSelect = useCallback((item: T) => {
    onSelect(item.id, item);
  }, [onSelect]);

  const renderItem = useCallback(({item}: {item: T}) => {
    const isSelected = item.id === selectedId;

    if (renderCustomItem) {
      return renderCustomItem(item, isSelected, () => handleItemSelect(item));
    }

    const itemName = String(item[displayProperty]);

    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.selectedItem]}
        onPress={() => handleItemSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={itemName}
        accessibilityHint={isSelected ? `${itemName} selected` : `Select ${itemName}`}
        accessibilityState={{selected: isSelected}}>
        <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
          {itemName}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedId, renderCustomItem, displayProperty, handleItemSelect]);

  const listStyle = useMemo(() => ({flexGrow: 0}), []);

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
      style={listStyle}
      ItemSeparatorComponent={ItemSeparator}
      // Performance optimizations
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
    />
  );
}

const styles = StyleSheet.create(theme => ({
  item: {
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  itemText: {
    fontSize: theme.typography.fontSize.md,
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
    paddingVertical: theme.spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));

export default ItemSelector;
