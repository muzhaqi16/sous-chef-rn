import React, { RefObject } from 'react';

import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type {
  SelectorConfig,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { SelectorItemContainer } from '#components/organisms/AnimatedItemSelector/SelectorItemContainer';
import { Text } from '#components/atoms/Text';

interface UsePantrySelectorConfigOptions {
  pantries: any[];
  selectedPantryId?: string;
  loading: boolean;
  setSelectedPantryId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  toPantrySettings: (params?: { pantryId?: string }) => void;
  toPantryAnalytics: (params: { pantryId: string }) => void;
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
    toPantrySettings,
    toPantryAnalytics,
  } = options;

  const renderPantryItem = (
    item: any,
    isSelected: boolean,
    onPress: () => void,
  ) => {
    return (
      <SelectorItemContainer
        state={isSelected ? 'selected' : 'default'}
        onPress={onPress}
      >
        <Text size="md" weight="semibold" style={styles.itemName}>
          {item.name}
        </Text>
        {!!isSelected && <Icon name="checkmark" size={20} tone="primary" />}
      </SelectorItemContainer>
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
          toPantrySettings();
        },
      },
      {
        icon: 'settings-outline',
        label: 'Edit Selected Pantry',
        onPress: () => {
          selectorRef.current?.close();
          if (selectedPantryId) {
            toPantrySettings({ pantryId: selectedPantryId });
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
            toPantryAnalytics({ pantryId: selectedPantryId });
          }
        },
        disabled: !selectedPantryId,
      },
    ],
  };
}

const styles = StyleSheet.create(() => ({
  itemName: {
    flex: 1,
  },
}));
