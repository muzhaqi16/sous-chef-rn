import React, { useState, useMemo } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
} from '#generated';
import { useStore } from '#store';
import { Button } from '#components';
import { AnimatedChip } from '#components/atoms/AnimatedChip';

export const SelectPantryItems = () => {
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();

  const { selectedPantryId } = useStore();

  const {
    data,
    loading,
    error: queryError,
  } = useGetOnboardingItemsQuery({
    variables: {
      filters: {
        showInOnboarding: true,
      },
      sort: {
        field: ItemSortField.Popularity,
        order: SortOrder.Asc,
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
      maxSelection: 5,
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
    >
      <KeyboardAwareScrollView style={styles.form}>
        <Text style={styles.helperText}>
          Select up to 5 items (you have {selectedItems.length} selected)
        </Text>
        <View style={styles.picker}>
          {items.map(item => (
            <AnimatedChip
              key={item.id}
              label={item.name}
              selected={item.selected}
              onPress={() => toggleItem(item.id)}
              disabled={!item.selected && isMaxReached}
            />
          ))}
        </View>
      </KeyboardAwareScrollView>

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
    marginTop: 24,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error || 'red',
    textAlign: 'center',
    marginVertical: 12,
  },
  loader: {
    marginVertical: 24,
  },
}));
