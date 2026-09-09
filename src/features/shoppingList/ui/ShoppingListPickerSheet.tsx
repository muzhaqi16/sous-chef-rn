import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  OnPrimaryActivityIndicator,
  Pressable,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import type {
  ItemSelectorRef,
  SelectorConfig,
} from '#components/organisms/AnimatedItemSelector/types';

interface ShoppingList {
  id: string;
  name: string;
  totalItems?: number | null;
  isDefault?: boolean | null;
}

interface ShoppingListPickerSheetProps {
  visible: boolean;
  shoppingLists: ShoppingList[];
  defaultNewListName: string;
  creatingList: boolean;
  onListSelected: (listId: string) => void;
  onCreateListAndAdd: (name: string) => void;
  onDismiss: () => void;
}

/**
 * Pick the shopping list something lands on, or name a new one. Built on the
 * kit's `AnimatedItemSelector` like every other list-in-a-tray in the app, so
 * the title inset, the top-right action and the tray chrome come from one
 * place rather than being re-solved here.
 */
export const ShoppingListPickerSheet: React.FC<
  ShoppingListPickerSheetProps
> = ({
  visible,
  shoppingLists,
  defaultNewListName,
  creatingList,
  onListSelected,
  onCreateListAndAdd,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const selectorRef = useRef<ItemSelectorRef>(null);
  const [newListName, setNewListName] = useState(defaultNewListName);
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    if (visible) {
      selectorRef.current?.open();
    } else {
      selectorRef.current?.close();
    }
  }, [visible]);

  const renderCustomItem = (
    item: ShoppingList,
    _isSelected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.listPickerItem,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.listPickerInfo}>
        <Text role="bodyStrong" style={styles.listPickerName}>
          {item.name}
        </Text>
        <Text role="caption" style={styles.listPickerCount}>
          {t('labels.itemCount', { count: item.totalItems ?? 0 })}
        </Text>
      </View>
      {!!item.isDefault && (
        <View style={styles.defaultBadge}>
          <Text role="label" style={styles.defaultBadgeText}>
            {t('shoppingListPicker.defaultBadge')}
          </Text>
        </View>
      )}
      <Icon name="chevron-forward" size={20} tone="textSecondary" />
    </Pressable>
  );

  const config: SelectorConfig<ShoppingList> = {
    title: t('labels.addToShoppingList'),
    data: shoppingLists,
    onSelect: id => onListSelected(id),
    displayProperty: 'name',
    actions: [],
    emptyMessage: t('shoppingListPicker.noLists'),
    renderCustomItem,
    // Top right, where every other tray puts its action.
    headerRight: (
      <Pressable
        onPress={() => setNaming(current => !current)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('shoppingListPicker.newListNamePlaceholder')}
      >
        <Text role="label" tone="primary">
          {naming ? t('labels.cancel') : t('shoppingListPicker.newList')}
        </Text>
      </Pressable>
    ),
    listHeader: naming ? (
      <View style={styles.createListRow}>
        <ThemedBottomSheetTextInput
          style={styles.createListInput}
          value={newListName}
          onChangeText={setNewListName}
          placeholder={t('shoppingListPicker.newListNamePlaceholder')}
          autoCapitalize="words"
          maxLength={100}
        />
        <Pressable
          style={({ pressed }) => [
            styles.createListButton,
            pressed && styles.pressed,
            !newListName.trim() && styles.createListButtonDisabled,
          ]}
          onPress={() => onCreateListAndAdd(newListName)}
          disabled={!newListName.trim() || creatingList}
          accessibilityRole="button"
          accessibilityLabel={t('shoppingListPicker.createAndAddIngredients')}
        >
          {creatingList ? (
            <OnPrimaryActivityIndicator />
          ) : (
            <Icon name="checkmark" size={20} tone="onPrimary" />
          )}
        </Pressable>
      </View>
    ) : undefined,
  };

  return (
    <AnimatedItemSelector
      ref={selectorRef}
      config={config}
      onClose={() => {
        setNaming(false);
        setNewListName(defaultNewListName);
        onDismiss();
      }}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  listPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  listPickerInfo: {
    flex: 1,
  },
  listPickerName: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  listPickerCount: {
    color: theme.colors.textSecondary,
  },
  defaultBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary + '20',
  },
  defaultBadgeText: {
    color: theme.colors.primary,
  },
  createListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  createListInput: {
    flex: 1,
  },
  createListButton: {
    width: theme.sizes.touchTarget.md,
    height: theme.sizes.touchTarget.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  createListButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
