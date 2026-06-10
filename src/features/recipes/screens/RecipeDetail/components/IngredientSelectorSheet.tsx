import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  OnPrimaryActivityIndicator,
  Pressable,
} from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import type { BottomSheetModalRef } from '#hooks/useStandardBottomSheet';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import {
  IngredientSelectionProvider,
  useIngredientSelection,
} from '../../../context/IngredientSelectionContext';

interface SelectableIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: { symbol: string } | null;
}

const ingredientKeyExtractor = (item: { id: string }) => item.id;

const SelectableIngredientItem: React.FC<
  ListRenderItemInfo<SelectableIngredient>
> = ({ item }) => {
  const { selectedIngredients, toggleIngredient } = useIngredientSelection();
  const isSelected = selectedIngredients.has(item.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.ingredientItem,
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => toggleIngredient(item.id)}
    >
      <Icon
        name={isSelected ? 'checkbox' : 'square-outline'}
        size={24}
        tone={isSelected ? 'primary' : 'textSecondary'}
      />
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{item.name}</Text>
        <Text style={styles.ingredientAmount}>
          {item.quantity ?? ''} {item.unit?.symbol || ''}
        </Text>
      </View>
    </Pressable>
  );
};

const getItemType = () => 'item';

const renderItem = (info: ListRenderItemInfo<SelectableIngredient>) => (
  <SelectableIngredientItem {...info} />
);

interface IngredientSelectorSheetProps {
  sheetRef: React.RefObject<BottomSheetModalRef | null>;
  ingredients: SelectableIngredient[];
  selectedIngredients: Set<string>;
  toggleIngredient: (id: string) => void;
  addingToList: boolean;
  onAddSelected: () => void;
  onDismiss: () => void;
  BottomSheetScrollable: ReturnType<typeof useBottomSheetScrollableCreator>;
}

export const IngredientSelectorSheet: React.FC<
  IngredientSelectorSheetProps
> = ({
  sheetRef,
  ingredients,
  selectedIngredients,
  toggleIngredient,
  addingToList,
  onAddSelected,
  onDismiss,
  BottomSheetScrollable,
}) => {
  const { t } = useTranslation();
  return (
    <BottomSheetAction
      sheetRef={sheetRef}
      sheetTitle={t('recipes.selectIngredients')}
      snapPoints={['50%', '75%', '90%']}
      onDismiss={onDismiss}
    >
      <IngredientSelectionProvider
        selectedIngredients={selectedIngredients}
        toggleIngredient={toggleIngredient}
      >
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={ingredients}
          keyExtractor={ingredientKeyExtractor}
          renderItem={renderItem}
          getItemType={getItemType}
          extraData={selectedIngredients.size}
          {...FLASHLIST_DEFAULTS.fullScreen}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {t('recipes.noIngredientsAvailable')}
            </Text>
          }
        />
      </IngredientSelectionProvider>
      <Pressable
        style={({ pressed }) => [
          styles.addSelectedButton,
          pressed && { opacity: 0.7 },
        ]}
        onPress={onAddSelected}
        disabled={selectedIngredients.size === 0 || addingToList}
      >
        {addingToList ? (
          <OnPrimaryActivityIndicator />
        ) : (
          <Text style={styles.addSelectedButtonText}>
            {t('recipes.addIngredientsCount', {
              count: selectedIngredients.size,
            })}
          </Text>
        )}
      </Pressable>
    </BottomSheetAction>
  );
};

const styles = StyleSheet.create(theme => ({
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  ingredientAmount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  addSelectedButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  addSelectedButtonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
