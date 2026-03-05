import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View } from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

const ItemSeparator = () => <View style={separatorStyle} />;

const separatorStyle = {height: 8};

const defaultKeyExtractor = (item: { id: string }) => item.id;

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
  renderCustomItem }: ItemSelectorProps<T>) {
  const {theme} = useUnistyles();

  const getKey = keyExtractor || defaultKeyExtractor;

  const handleItemSelect = (item: T) => {
    onSelect(item.id, item);
  };

  const renderItem = ({item}: {item: T}) => {
    const isSelected = item.id === selectedId;

    if (renderCustomItem) {
      return renderCustomItem(item, isSelected, () => handleItemSelect(item));
    }

    const itemName = String(item[displayProperty]);

    return (
      <Pressable
        style={({pressed}) => [styles.item, isSelected && styles.selectedItem, pressed && styles.pressed]}
        onPress={() => handleItemSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={itemName}
        accessibilityHint={isSelected ? `${itemName} selected` : `Select ${itemName}`}
        accessibilityState={{selected: isSelected}}>
        <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
          {itemName}
        </Text>
      </Pressable>
    );
  };

  const listStyle = ({flexGrow: 0});

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
    <FlashList
      data={data}
      keyExtractor={getKey}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={listStyle}
      ItemSeparatorComponent={ItemSeparator}
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
    borderColor: 'transparent' },
  selectedItem: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary },
  itemText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary },
  selectedItemText: {
    fontWeight: 'bold',
    color: theme.colors.primary },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center' },
  pressed: {
    opacity: theme.opacity.pressed } }));

export default ItemSelector;
