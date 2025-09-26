import React, { useState } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { OnBoardingWrapper } from '#components/templates';
import { StyleSheet } from 'react-native-unistyles';
import { useOnboardingNavigation } from '#hooks';
import {
  useGetOnboardingItemsQuery,
  useAddItemToPantryMutation,
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  GetOnboardingItemsQuery,
} from '#generated';
import { useStore } from '#store';
import { Button } from '#components';

type OnboardingItemType = NonNullable<
  GetOnboardingItemsQuery['onboardingItems']
>[number];

export const SelectPantryItems = () => {
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();

  const { selectedPantryId } = useStore();

  const {
    data,
    loading,
    error: queryError,
  } = useGetOnboardingItemsQuery({
    fetchPolicy: 'cache-and-network',
  });
  const [addItemToPantry] = useAddItemToPantryMutation({
    onError: e => console.error(e),
  });

  const [selected, setSelected] = useState<OnboardingItemType[]>([]);
  const [isAddingItems, setIsAddingItems] = useState(false);

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

  const handleSelect = (item: OnboardingItemType) => {
    setSelected(current => {
      const exists = current.find(i => i.id === item.id);
      if (exists) {
        return current.filter(i => i.id !== item.id);
      }
      if (current.length >= 5) {
        console.warn('You can only select up to 5 items');
        return current;
      }
      return [...current, item];
    });
  };

  const onNext = async () => {
    if (selected.length > 0 && selectedPantryId) {
      setIsAddingItems(true);

      try {
        // Add all selected items to pantry
        await Promise.all(
          selected.map(item => {
            // Find the default unit or use the first available unit
            const defaultUnit = item.units?.find(u => u?.unit?.isCommon);
            const unitToUse = defaultUnit || item.units?.[0];

            return addItemToPantry({
              variables: {
                input: {
                  pantryId: selectedPantryId,
                  itemId: item.id,
                  unitId: unitToUse?.unit?.id || '',
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
          Select up to 5 items (you have {selected.length} selected)
        </Text>
        <View style={styles.picker}>
          {data?.onboardingItems?.map(item => {
            const active = selected.some(
              selectedItem => selectedItem.id === item.id,
            );
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item)}
                style={[styles.pickerItem, active && styles.pickerItemActive]}
              >
                <Text
                  style={[
                    styles.pickerLabel,
                    active && styles.pickerLabelActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </KeyboardAwareScrollView>

      <Button
        title={
          isAddingItems
            ? 'Adding Items...'
            : `Add ${selected.length > 0 ? selected.length : ''} Item${
                selected.length === 1 ? '' : 's'
              }`
        }
        onPress={onNext}
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
        disabled={isAddingItems || selected.length === 0}
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
  },
  pickerItem: {
    margin: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c9d3db',
    borderRadius: 20,
  },
  pickerItemActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
  },
  pickerLabelActive: {
    color: theme.colors.white,
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
