import React, { useState } from 'react';
import { View, Text } from 'react-native';
import {
  OnPrimaryActivityIndicator,
  Pressable,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FlashList } from '@shopify/flash-list';
import type {
  BottomSheetModal,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';

interface ShoppingList {
  id: string;
  name: string;
  totalItems?: number | null;
  isDefault?: boolean | null;
}

interface ShoppingListPickerSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  shoppingLists: ShoppingList[];
  defaultNewListName: string;
  creatingList: boolean;
  onListSelected: (listId: string) => void;
  onCreateListAndAdd: (name: string) => void;
  onDismiss: () => void;
  BottomSheetScrollable: ReturnType<typeof useBottomSheetScrollableCreator>;
}

export const ShoppingListPickerSheet: React.FC<
  ShoppingListPickerSheetProps
> = ({
  sheetRef,
  shoppingLists,
  defaultNewListName,
  creatingList,
  onListSelected,
  onCreateListAndAdd,
  onDismiss,
  BottomSheetScrollable,
}) => {
  const [newListName, setNewListName] = useState(defaultNewListName);

  const renderListItem = ({ item }: { item: ShoppingList }) => (
    <Pressable
      style={({ pressed }) => [
        styles.listPickerItem,
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => onListSelected(item.id)}
    >
      <View style={styles.listPickerInfo}>
        <Text style={styles.listPickerName}>{item.name}</Text>
        <Text style={styles.listPickerCount}>{item.totalItems ?? 0} items</Text>
      </View>
      {!!item.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}
      <Icon name="chevron-forward" size={20} tone="textSecondary" />
    </Pressable>
  );

  return (
    <BottomSheetAction
      sheetRef={sheetRef}
      sheetTitle="Add to Shopping List"
      snapPoints={['60%']}
      scrollable={false}
      onDismiss={() => {
        setNewListName(defaultNewListName);
        onDismiss();
      }}
    >
      <FlashList
        renderScrollComponent={BottomSheetScrollable}
        data={shoppingLists}
        keyExtractor={(item: ShoppingList) => item.id}
        style={styles.shoppingListFlashList}
        contentContainerStyle={styles.shoppingListContent}
        renderItem={renderListItem}
        ListFooterComponent={
          <View style={styles.createListFooter}>
            <View style={styles.createListInputRow}>
              <ThemedBottomSheetTextInput
                style={styles.createListInput}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="New list name"
                autoCapitalize="words"
                maxLength={100}
              />
              {!!newListName && (
                <Pressable
                  style={({ pressed }) => [
                    styles.clearNameButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setNewListName('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close-circle" size={20} tone="textSecondary" />
                </Pressable>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.createListButton,
                pressed && { opacity: 0.7 },
                !newListName.trim() && { opacity: 0.5 },
              ]}
              onPress={() => onCreateListAndAdd(newListName)}
              disabled={!newListName.trim() || creatingList}
            >
              {creatingList ? (
                <OnPrimaryActivityIndicator />
              ) : (
                <Text style={styles.createListButtonText}>
                  Create & Add Ingredients
                </Text>
              )}
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyListPicker}>
            <Text style={styles.emptyText}>No existing lists</Text>
          </View>
        }
      />
    </BottomSheetAction>
  );
};

const styles = StyleSheet.create(theme => ({
  listPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  listPickerInfo: {
    flex: 1,
  },
  listPickerName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  listPickerCount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  defaultBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primary + '20',
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  emptyListPicker: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  createListFooter: {
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  createListInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  createListInput: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  clearNameButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  createListButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  shoppingListFlashList: {
    flex: 1,
  },
  shoppingListContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
  },
  createListButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
