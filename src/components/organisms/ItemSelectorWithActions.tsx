import React from 'react';
import {
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  View,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon, IconLibrary} from '#utils/iconUtils';
import {ListActionButtons} from '../molecules/ListActionButtons';

// Generic interface for selectable items
interface SelectableItem {
  id: string;
  [key: string]: any;
}

interface ActionButton {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  iconLibrary?: IconLibrary;
}

interface ItemSelectorWithActionsProps<T extends SelectableItem> {
  data: T[];
  selectedId?: string;
  onSelect: (id: string, item: T) => void;
  displayProperty: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T) => string;
  renderCustomItem?: (
    item: T,
    isSelected: boolean,
    onPress: () => void,
  ) => React.ReactElement;
  actions?: ActionButton[];
  showActions?: boolean;
}

export function ItemSelectorWithActions<T extends SelectableItem>({
  data,
  selectedId,
  onSelect,
  displayProperty,
  loading = false,
  emptyMessage = 'No items available',
  keyExtractor,
  renderCustomItem,
  actions = [],
  showActions = true,
}: ItemSelectorWithActionsProps<T>) {
  const {theme} = useUnistyles();

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
        {isSelected && (
          <Icon
            name="check-circle"
            size={20}
            color={theme.colors.primary}
            library="MaterialIcons"
          />
        )}
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

  return (
    <View style={styles.container}>
      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={getKey}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {showActions && actions.length > 0 && (
        <ListActionButtons actions={actions} />
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
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
    flex: 1,
  },
  selectedItemText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  separator: {
    height: 8,
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
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));

export default ItemSelectorWithActions;