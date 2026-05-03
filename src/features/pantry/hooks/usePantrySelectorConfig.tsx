import React, { RefObject } from 'react';

import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { Text } from '#components/atoms/Text';

interface UsePantrySelectorConfigOptions {
  pantries: any[];
  selectedPantryId?: string;
  loading: boolean;
  setSelectedPantryId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  navigate: (screen: string, params?: object) => void;
}

export function usePantrySelectorConfig(
  options: UsePantrySelectorConfigOptions,
): SelectorConfig<any> {
  const {
    pantries,
    selectedPantryId,
    loading,
    setSelectedPantryId,
    selectorRef,
    navigate,
  } = options;

  const {
    theme: { colors },
  } = useUnistyles();

  const renderPantryItem = (
    item: any,
    isSelected: boolean,
    onPress: () => void,
  ) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.itemContainer,
          isSelected && styles.itemSelected,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
      >
        <Text size="md" weight="semibold" style={styles.itemName}>
          {item.name}
        </Text>
        {!!isSelected && (
          <Icon name="checkmark" size={20} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  return {
    title: 'Select Pantry',
    data: pantries,
    selectedId: selectedPantryId,
    onSelect: (id: string) => {
      setSelectedPantryId(id);
      selectorRef.current?.close();
    },
    displayProperty: 'name',
    loading,
    emptyMessage: 'No pantries available',
    renderCustomItem: renderPantryItem,
    actions: [
      {
        icon: 'add',
        label: 'Create New Pantry',
        onPress: () => {
          selectorRef.current?.close();
          navigate('PantrySettings', { pantryId: undefined });
        },
      },
      {
        icon: 'settings-outline',
        label: 'Edit Selected Pantry',
        onPress: () => {
          selectorRef.current?.close();
          if (selectedPantryId) {
            navigate('PantrySettings', { pantryId: selectedPantryId });
          }
        },
        disabled: !selectedPantryId,
      },
      {
        icon: 'bar-chart-outline',
        label: 'View Analytics',
        onPress: () => {
          selectorRef.current?.close();
          if (selectedPantryId) {
            navigate('PantryAnalytics', { pantryId: selectedPantryId });
          }
        },
        disabled: !selectedPantryId,
      },
    ],
  };
}

const styles = StyleSheet.create(theme => ({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  itemName: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
