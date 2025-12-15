import React, { useState, useMemo } from 'react';
import { Text, ActivityIndicator, ScrollView, View } from 'react-native';
import { OnBoardingWrapper } from '#components/templates';
import { StyleSheet } from 'react-native-unistyles';
import { useOnboardingNavigation, useSelectableItems } from '#hooks';
import {
  useGetOnboardingItemsQuery,
  useCreatePantryItemMutation,
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  ItemSortField,
  SortOrder,
  ItemType,
} from '#generated';
import { useAppStore } from '#store/useAppStore';
import { Button } from '#components';
import { AnimatedChip } from '#components/atoms/AnimatedChip';

export const SelectPantryItems = () => {
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();

  const selectedPantryId = useAppStore(state => state.selectedPantryId);

  const {
    data,
    loading,
    error: queryError,
  } = useGetOnboardingItemsQuery({
    variables: {
      filters: {
        showInOnboarding: true,
        types: [ItemType.Food, ItemType.Foundation],
      },
      sort: {
        field: ItemSortField.Popularity,
        order: SortOrder.Asc,
      },
      pagination: {
        take: 150,
      },
    },
    fetchPolicy: 'cache-and-network',
  });
  const [addItemToPantry] = useCreatePantryItemMutation({
    onError: (e: any) => console.error(e),
  });

  const [isAddingItems, setIsAddingItems] = useState(false);

  // Transform onboarding items into selectable items with id and selected properties
  const selectableItems = useMemo(
    () =>
      (data?.items?.items || []).map((item: any) => ({
        ...item,
        selected: false,
      })),
    [data?.items],
  );

  // Use the custom hook for managing selection state
  const { items, selectedItems, toggleItem, isMaxReached } = useSelectableItems(
    {
      initialItems: selectableItems,
      maxSelection: 100,
    },
  );

  if (loading) {
    return (
      <OnBoardingWrapper
        title="Stock your pantry"
        subtitle="Select items you already have at home"
        step={3}
        totalSteps={7}
        onBack={() => navigateToPreviousStep('CreateShoppingList')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <ActivityIndicator style={styles.loader} />
      </OnBoardingWrapper>
    );
  }

  if (queryError) {
    return (
      <OnBoardingWrapper
        title="Stock your pantry"
        subtitle="Select items you already have at home"
        step={3}
        totalSteps={7}
        onBack={() => navigateToPreviousStep('CreateShoppingList')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <Text style={styles.errorText}>
          Unable to load items. Please try again.
        </Text>
      </OnBoardingWrapper>
    );
  }

  const onNext = async () => {
    if (selectedItems.length > 0 && selectedPantryId) {
      setIsAddingItems(true);

      try {
        // Add all selected items to pantry
        await Promise.all(
          selectedItems.map(item => {
            return addItemToPantry({
              variables: {
                input: {
                  pantryId: selectedPantryId,
                  itemId: item.id,
                  unitId: item.displayUnit?.id || '',
                  initialQuantity: 1,
                  storageState: StorageState.Ambient,
                  condition: ItemCondition.Good,
                  acquisitionMethod: AcquisitionMethod.Purchased,
                },
              },
            });
          }),
        );
      } catch (error) {
        console.error('Error adding items to pantry:', error);
      } finally {
        setIsAddingItems(false);
      }
    }
    navigateToNextStep('SelectPantryItems');
  };

  return (
    <OnBoardingWrapper
      title="Stock your pantry"
      subtitle="Select items you already have at home (optional)"
      step={3}
      totalSteps={7}
      onBack={() => navigateToPreviousStep('CreateShoppingList')}
      onSkip={() => navigateToNextStep('SelectPantryItems')}
      testID="onboarding-select-pantry-items-screen"
    >
      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helperText}>{selectedItems.length} selected</Text>
        <View style={styles.chipContainer}>
          {items.map(item => (
            <AnimatedChip
              key={item.id}
              label={item.name}
              selected={item.selected}
              onPress={() => toggleItem(item.id)}
              disabled={!item.selected && isMaxReached}
              imageUrl={item.imageUrl}
            />
          ))}
        </View>
      </ScrollView>

      <Button
        title={
          isAddingItems
            ? 'Adding Items...'
            : `Add ${
                selectedItems.length > 0 ? selectedItems.length : ''
              } Item${selectedItems.length === 1 ? '' : 's'}`
        }
        onPress={onNext}
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
        disabled={isAddingItems || selectedItems.length === 0}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  form: {
    flex: 1,
    marginBottom: theme.spacing['3'],
  },
  helperText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginVertical: theme.spacing['3'],
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
}));
