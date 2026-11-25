import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import {
  OnPrimaryActivityIndicator,
  Pressable,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import { DataStateView } from '#components/organisms/DataStateView';
import type { DataState } from '#hooks/data/useDataState';
import type { SelectorConfig } from '#components/organisms/AnimatedItemSelector/types';
import { LIST_NAME_MAX_LENGTH } from '#features/shoppingList/utils/shoppingListConstants';
import { reportValidationErrors } from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';
import { newListSchema, type NewListFormValues } from './newListFormConfig';

interface ShoppingList {
  id: string;
  name: string;
  totalItems?: number | null;
  isDefault?: boolean | null;
}

interface NewListFormProps {
  defaultName: string;
  creating: boolean;
  onCreate: (name: string) => void;
}

/** A new list's name, mounted fresh each time naming opens. */
const NewListForm: React.FC<NewListFormProps> = ({
  defaultName,
  creating,
  onCreate,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<NewListFormValues>({
    resolver: yupResolver(newListSchema),
    defaultValues: { name: defaultName },
  });
  useSheetUnsavedInput(isDirty);
  const create = handleSubmit(({ name }) => {
    onCreate(name);
  }, reportValidationErrors);

  return (
    <Controller
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <View style={styles.createList}>
          <View style={styles.createListRow}>
            <ThemedTextInput
              style={styles.createListInput}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('shoppingListPicker.newListNamePlaceholder')}
              autoCapitalize="words"
              maxLength={LIST_NAME_MAX_LENGTH}
            />
            <Pressable
              style={({ pressed }) => [
                styles.createListButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                void create();
              }}
              disabled={creating}
              accessibilityRole="button"
              accessibilityLabel={t(
                'shoppingListPicker.createAndAddIngredients',
              )}
            >
              {creating ? (
                <OnPrimaryActivityIndicator />
              ) : (
                <Icon name="checkmark" size="sm" tone="onPrimary" />
              )}
            </Pressable>
          </View>
          {fieldState.error ? (
            <Text role="error" tone="error" style={styles.createListError}>
              {fieldState.error.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
};

interface ShoppingListPickerSheetProps {
  visible: boolean;
  shoppingLists: ShoppingList[];
  listsState: DataState;
  onRetryLists: () => void;
  defaultNewListName: string;
  creatingList: boolean;
  onListSelected: (listId: string) => void;
  onCreateListAndAdd: (name: string) => void;
  onDismiss: () => void;
}

/**
 * Pick the shopping list something lands on, or name a new one. The kit's
 * `AnimatedItemSelector` supplies the tray chrome, as for every list-in-a-tray.
 */
export const ShoppingListPickerSheet: React.FC<
  ShoppingListPickerSheetProps
> = ({
  visible,
  shoppingLists,
  listsState,
  onRetryLists,
  defaultNewListName,
  creatingList,
  onListSelected,
  onCreateListAndAdd,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [naming, setNaming] = useState(false);

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
            {t('labels.defaultBadge')}
          </Text>
        </View>
      )}
      <Icon name="chevron-forward" size="sm" tone="textSecondary" />
    </Pressable>
  );

  const config: SelectorConfig<ShoppingList> = {
    title: t('labels.addToShoppingList'),
    data: shoppingLists,
    onSelect: id => onListSelected(id),
    displayProperty: 'name',
    actions: [],
    emptyMessage: t('shoppingListPicker.noLists'),
    emptyContent:
      listsState === 'error' || listsState === 'offline' ? (
        <DataStateView state={listsState} onRetry={onRetryLists} />
      ) : undefined,
    renderCustomItem,
    // Top right, where every other tray puts its action.
    headerActions: [
      {
        label: naming ? t('labels.cancel') : t('shoppingListPicker.newList'),
        onPress: () => setNaming(current => !current),
      },
    ],
    listHeader: naming ? (
      <NewListForm
        defaultName={defaultNewListName}
        creating={creatingList}
        onCreate={onCreateListAndAdd}
      />
    ) : undefined,
  };

  return (
    <AnimatedItemSelector
      isVisible={visible}
      config={config}
      onClose={() => {
        setNaming(false);
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
    backgroundColor: theme.colors.primaryLight,
  },
  defaultBadgeText: {
    color: theme.colors.onPrimaryLight,
  },
  createList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  createListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  createListError: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
