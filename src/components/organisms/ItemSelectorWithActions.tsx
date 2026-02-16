import React from 'react';
import {
  Pressable,
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
      <Pressable
        style={({pressed}) => [styles.item, isSelected && styles.selectedItem, pressed && styles.pressed]}
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
      </Pressable>
    );
  };

  // PERFORMANCE: getItemLayout for better scroll performance
  // Item height = paddingVertical (32) + text (~24) + border (2) + separator (8) ≈ 66px
  // Only use when renderCustomItem is not provided (standard items have fixed height)
  const getItemLayout = !renderCustomItem
    ? (_data: ArrayLike<T> | null | undefined, index: number) => ({
        length: 66,
        offset: 66 * index,
        index,
      })
    : undefined;

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
          getItemLayout={getItemLayout}
          // Performance optimizations
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
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
    flex: 1,
  },
  selectedItemText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  separator: {
    height: theme.spacing.sm,
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
    paddingHorizontal: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
}));

export default ItemSelectorWithActions;