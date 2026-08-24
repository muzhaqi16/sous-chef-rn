import React, { RefObject } from 'react';
import { useTranslation } from '#/i18n';

import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type {
  SelectorConfig,
  SelectableItem,
  ItemSelectorRef,
} from '#components/organisms/AnimatedItemSelector/types';
import { SelectorItemContainer } from '#components/organisms/AnimatedItemSelector/SelectorItemContainer';
import { Text } from '#components/atoms/Text';

// Minimal shape the selector reads off each pantry (id + display name).
interface PantrySelectorItem extends SelectableItem {
  name?: string;
}

interface UsePantrySelectorConfigOptions {
  pantries: PantrySelectorItem[];
  selectedPantryId?: string;
  loading: boolean;
  setSelectedPantryId: (id: string) => void;
  selectorRef: RefObject<ItemSelectorRef | null>;
  toPantrySettings: (params?: { pantryId?: string }) => void;
  toPantryAnalytics: (params: { pantryId: string }) => void;
}

export function usePantrySelectorConfig(
  options: UsePantrySelectorConfigOptions,
): SelectorConfig<PantrySelectorItem> {
  const { t } = useTranslation();
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
    item: PantrySelectorItem,
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
    title: t('labels.selectPantry'),
    data: pantries,
    selectedId: selectedPantryId,
    onSelect: (id: string) => {
      setSelectedPantryId(id);
      selectorRef.current?.close();
    },
    displayProperty: 'name',
    loading,
    emptyMessage: t('pantrySelector.emptyMessage'),
    renderCustomItem: renderPantryItem,
    actions: [
      {
        icon: 'add',
        label: t('labels.create'),
        onPress: () => {
          selectorRef.current?.close();
          toPantrySettings();
        },
      },
      {
        icon: 'settings-outline',
        label: t('labels.edit'),
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
        label: t('pantrySelector.viewAnalytics'),
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
