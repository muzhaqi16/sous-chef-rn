import React, { RefObject } from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type {
  SelectorConfig,
  ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';

interface UsePantrySelectorConfigOptions {
  /**
   * Array of available pantries
   */
  pantries: any[];

  /**
   * Currently selected pantry ID
   */
  selectedPantryId?: string;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Function to update selected pantry
   */
  setSelectedPantryId: (id: string) => void;

  /**
   * Reference to the selector component
   */
  selectorRef: RefObject<ItemSelectorRef | null>;

  /**
   * Navigation function
   */
  navigate: (screen: string, params?: any) => void;
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
    navigate } = options;

  const {
    theme: { colors } } = useUnistyles();

  const renderPantryItem = (item: any, isSelected: boolean, onPress: () => void) => {
      return (
        <Pressable
          style={({ pressed }) => [
            styles.itemContainer,
            isSelected && styles.itemSelected,
            pressed && styles.pressed,
          ]}
          onPress={onPress}
        >
          <Text style={styles.itemName}>{item.name}</Text>
          {!!isSelected && <Icon name="checkmark" size={20} color={colors.primary} />}
        </Pressable>
      );
    };

  return ({
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
          } },
        {
          icon: 'settings-outline',
          label: 'Edit Selected Pantry',
          onPress: () => {
            selectorRef.current?.close();
            if (selectedPantryId) {
              navigate('PantrySettings', { pantryId: selectedPantryId });
            }
          },
          disabled: !selectedPantryId },
        {
          icon: 'bar-chart-outline',
          label: 'View Analytics',
          onPress: () => {
            selectorRef.current?.close();
            if (selectedPantryId) {
              navigate('PantryAnalytics', { pantryId: selectedPantryId });
            }
          },
          disabled: !selectedPantryId },
      ] });
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
    borderColor: theme.colors.border },
  itemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary },
  itemName: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary },
  pressed: {
    opacity: theme.opacity.pressed } }));
