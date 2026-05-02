import React, { useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useSelectableItems } from '#hooks/useSelectableItems';
import { useMutation, useQuery } from '@apollo/client/react';
import { GetOnboardingItemsDocument } from '../../graphql/operations/item/item.generated';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  DeletePantryItemDocument,
} from '#operations/pantry/pantry.generated';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  ItemSortField,
  SortOrder,
  ItemType,
} from '#/graphql/generated/schemaTypes';
import { extractNodes } from '#/utils/connectionUtils';
import { removeFromPantryItemsCache } from '#/hooks/home/pantry/utils';
import { useAppStore } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { AnimatedChip } from '#components/atoms/AnimatedChip';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export const SelectPantryItems = () => {
  useScreenTransition('SelectPantryItems');
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();

  const selectedPantryId = useAppStore(state => state.selectedPantryId);

  const {
    data,
    loading,
    error: queryError,
    refetch,
  } = useQuery(GetOnboardingItemsDocument, {
    variables: {
      filters: {
        curation: { showInOnboarding: true },
        types: [ItemType.Food, ItemType.Foundation],
      },
      sort: {
        field: ItemSortField.Popularity,
        order: SortOrder.Asc,
      },
      first: 50,
    },
  });

  const { data: pantryData, loading: pantryLoading } = useQuery(
    GetPantryDocument,
    {
      variables: { id: selectedPantryId!, itemsFirst: 100 },
      skip: !selectedPantryId,
    },
  );

  const [addItemToPantry] = useMutation(CreatePantryItemDocument);
  const [deletePantryItem] = useMutation(DeletePantryItemDocument);

  const [isSaving, setIsSaving] = useState(false);

  // Map catalog item IDs to pantry item IDs for existing pantry items
  const pantryItems = extractNodes(pantryData?.pantry?.itemsConnection);
  const map = new Map<string, string>();
  const ids = new Set<string>();
  for (const pantryItem of pantryItems) {
    const catalogId = pantryItem.item?.id ?? pantryItem.itemId;
    if (catalogId) {
      map.set(catalogId, pantryItem.id);
      ids.add(catalogId);
    }
  }
  const { existingItemMap, existingCatalogIds } = {
    existingItemMap: map,
    existingCatalogIds: ids,
  };

  // Transform onboarding items into selectable items, pre-selecting existing pantry items
  const selectableItems = (
    data?.items?.edges?.map(edge => edge.node) || []
  ).map((item: any) => ({
    ...item,
    selected: existingCatalogIds.has(item.id),
  }));

  // Use the custom hook for managing selection state
  const { items, selectedItems, toggleItem, isMaxReached } = useSelectableItems(
    {
      initialItems: selectableItems,
      maxSelection: 100,
    },
  );

  if (loading || pantryLoading) {
    return (
      <OnBoardingWrapper
        title="Stock your pantry"
        subtitle="Select items you already have at home"
        step={3}
        totalSteps={7}
        onBack={() => navigateToPreviousStep('CreateShoppingList')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <SousChefLoader size="small" showBrand={false} message="Loading" />
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Unable to load items. Please try again.
          </Text>
          <Button onPress={() => refetch()} variant="primary">
            Try Again
          </Button>
        </View>
      </OnBoardingWrapper>
    );
  }

  const selectedIds = new Set(selectedItems.map(i => i.id));
  const itemsToAdd = selectedItems.filter(i => !existingCatalogIds.has(i.id));
  const itemsToRemove = [...existingCatalogIds].filter(
    id => !selectedIds.has(id),
  );
  const hasChanges = itemsToAdd.length > 0 || itemsToRemove.length > 0;
  const isFirstVisit = existingCatalogIds.size === 0;

  const onNext = () => {
    if (hasChanges && selectedPantryId) {
      executeWithLoadingState(
        async () => {
          await Promise.all([
            ...itemsToAdd.map(item =>
              addItemToPantry({
                variables: {
                  input: {
                    pantryId: selectedPantryId,
                    itemId: item.id,
                    ...(item.displayUnit?.id && {
                      unit: { unitId: item.displayUnit.id },
                    }),
                    quantity: null,
                    storage: {
                      storageState: StorageState.Ambient,
                      condition: ItemCondition.Good,
                    },
                    purchase: {
                      acquisitionMethod: AcquisitionMethod.Purchased,
                    },
                  },
                },
              }),
            ),
            ...itemsToRemove.map(catalogId => {
              const pantryItemId = existingItemMap.get(catalogId)!;
              return deletePantryItem({
                variables: { id: pantryItemId },
                update: cache => {
                  removeFromPantryItemsCache(
                    cache,
                    selectedPantryId,
                    pantryItemId,
                  );
                },
              });
            }),
          ]);
          navigateToNextStep('SelectPantryItems');
        },
        setIsSaving,
        error => {
          errorService.reportError(error, {
            operation: 'SelectPantryItems.updatePantryItems',
          });
          navigateToNextStep('SelectPantryItems');
        },
      );
      return;
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
          isSaving
            ? 'Saving...'
            : isFirstVisit
            ? `Add ${
                selectedItems.length > 0 ? selectedItems.length : ''
              } Item${selectedItems.length === 1 ? '' : 's'}`
            : hasChanges
            ? 'Save Changes'
            : 'Continue'
        }
        onPress={onNext}
        variant="primary"
        disabled={isSaving || (isFirstVisit && selectedItems.length === 0)}
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
    paddingHorizontal: theme.spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
}));
