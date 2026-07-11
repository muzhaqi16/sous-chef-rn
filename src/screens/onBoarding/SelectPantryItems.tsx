import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useSelectableItems } from '#hooks/useSelectableItems';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { GetOnboardingItemsDocument } from '#operations/item/item.generated';
import {
  SelectPantryItems_PantryItemFragmentDoc,
  type SelectPantryItems_PantryItemFragment,
} from './SelectPantryItems.generated';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  DeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  SortOrder,
  ItemType,
} from '#/graphql/generated/schemaTypes';
import { extractNodes } from '#/utils/connectionUtils';
import { removeFromPantryItemsCache } from '#/hooks/home/pantry/utils';
import { useSelectedPantryId } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { AnimatedChip } from '#components/atoms/AnimatedChip';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { generateEntityId } from '#/utils/generateEntityId';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export const SelectPantryItems = () => {
  const { t } = useTranslation();
  useScreenTransition('SelectPantryItems');
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();
  const apolloClient = useApolloClient();

  const selectedPantryId = useSelectedPantryId();

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
      orderBy: {
        popularity: SortOrder.Asc,
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

  // Map catalog item IDs to pantry item IDs for existing pantry items.
  // pantryItems comes back as masked refs — materialize each via
  // cache.readFragment with a narrow `SelectPantryItems_pantryItem` fragment
  // that selects only `id`, `itemId`, and `item.id`.
  const pantryItemRefs = extractNodes(pantryData?.pantry?.itemsConnection);
  const map = new Map<string, string>();
  const ids = new Set<string>();
  for (const ref of pantryItemRefs) {
    const pantryItem =
      apolloClient.cache.readFragment<SelectPantryItems_PantryItemFragment>({
        fragment: SelectPantryItems_PantryItemFragmentDoc,
        fragmentName: 'SelectPantryItems_pantryItem',
        from: ref,
      });
    if (!pantryItem) continue;
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
  ).map(item => ({
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
        title={t('onBoarding.stockPantryTitle')}
        subtitle={t('onBoarding.stockPantrySubtitle')}
        step={3}
        totalSteps={7}
        onBack={() => navigateToPreviousStep('CreateShoppingList')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <SousChefLoader
          size="small"
          showBrand={false}
          message={t('loading.loading')}
        />
      </OnBoardingWrapper>
    );
  }

  if (queryError) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.stockPantryTitle')}
        subtitle={t('onBoarding.stockPantrySubtitle')}
        step={3}
        totalSteps={7}
        onBack={() => navigateToPreviousStep('CreateShoppingList')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <View style={styles.errorContainer}>
          <Text tone="error" align="center" style={styles.errorText}>
            {t('errors.loadItemsFailed')}
          </Text>
          <Button onPress={() => refetch()} variant="primary">
            {t('onBoarding.tryAgain')}
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
            ...itemsToAdd.map(item => {
              const id = generateEntityId();
              return addItemToPantry({
                variables: {
                  input: {
                    id,
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
                context: { localFirst: true },
              });
            }),
            ...itemsToRemove.map(catalogId => {
              const pantryItemId = existingItemMap.get(catalogId)!;
              return deletePantryItem({
                variables: { input: { id: pantryItemId } },
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
      title={t('onBoarding.stockPantryTitle')}
      subtitle={t('onBoarding.stockPantrySubtitleOptional')}
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
        <Text
          size="sm"
          tone="secondary"
          align="center"
          style={styles.helperText}
        >
          {t('onBoarding.itemsSelected', { count: selectedItems.length })}
        </Text>
        <View style={styles.chipContainer}>
          {items.map(item => (
            <AnimatedChip
              key={item.id}
              label={item.name}
              selected={item.selected}
              onPress={() => toggleItem(item.id)}
              disabled={!item.selected && isMaxReached}
              imageUrl={item.imageUrl ?? undefined}
            />
          ))}
        </View>
      </ScrollView>

      <Button
        title={
          isSaving
            ? t('onBoarding.saving')
            : isFirstVisit
            ? selectedItems.length === 0
              ? t('onBoarding.addItemsZero')
              : t(
                  selectedItems.length === 1
                    ? 'onBoarding.addItemSingular'
                    : 'onBoarding.addItemPlural',
                  { count: selectedItems.length },
                )
            : hasChanges
            ? t('onBoarding.saveChanges')
            : t('labels.continue')
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
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.lg,
  },
  loader: {
    marginVertical: theme.spacing.xl,
  },
}));
