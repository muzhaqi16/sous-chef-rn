import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useSelectableItems } from '#hooks/useSelectableItems';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { GetOnboardingItemsDocument } from '#operations/item/item.generated';
import {
  SelectPantryItems_PantryItemFragmentDoc,
  type SelectPantryItems_PantryItemFragment,
} from './SelectPantryItems.generated';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  DeletePantryItemDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
  SortOrder,
  ItemType,
} from '#/graphql/generated/schemaTypes';
import { extractNodes } from '#/utils/connectionUtils';
import { removeFromPantryItemsCache } from '#/apollo/utils/pantryCacheUpdaters';
import { useSelectedPantryId } from '#store/useAppStore';
import { Button } from '#components/atoms/Button';
import { AnimatedChip } from '#components/atoms/AnimatedChip';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { generateEntityId } from '#/utils/generateEntityId';
import { getPantryItemDuplicateFromResult } from '#/utils/errors/pantryItemDuplicate';
import { logger } from '#/utils/environment';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { SousChefLoader } from '#components/atoms/SousChefLoader';

type PantryItemsConnection = NonNullable<
  GetPantryQuery['pantry']
>['itemsConnection'];

interface ExistingPantryIndex {
  /** catalog item id → the pantry item id that already stocks it */
  existingItemMap: Map<string, string>;
  /** catalog item ids already in the pantry */
  existingCatalogIds: Set<string>;
}

// Keyed on the connection object Apollo hands back, which keeps its identity
// until the pantry's item set actually changes. Mirrors the WeakMap in
// `connectionUtils.extractNodes`. Only identity fields are read below
// (`id`, `itemId`, `item.id`), and those never change for a given pantry item,
// so a hit can't go stale while the connection stays the same object.
const existingPantryIndexCache = new WeakMap<object, ExistingPantryIndex>();

/**
 * Index the pantry's existing items by catalog id.
 *
 * Each row arrives as a masked ref, so resolving it costs one cache read —
 * up to `itemsFirst` of them per call. The React Compiler leaves this
 * derivation uncached in the component body (verified against the compiled
 * output), which would re-read every row on each render, including every chip
 * tap, so the result is cached explicitly here instead.
 */
function buildExistingPantryIndex(
  cache: ApolloCache,
  itemsConnection: PantryItemsConnection | undefined,
): ExistingPantryIndex {
  if (!itemsConnection) {
    return {
      existingItemMap: new Map(),
      existingCatalogIds: new Set(),
    };
  }
  const cached = existingPantryIndexCache.get(itemsConnection);
  if (cached) return cached;

  const existingItemMap = new Map<string, string>();
  const existingCatalogIds = new Set<string>();
  for (const ref of extractNodes(itemsConnection)) {
    const pantryItem = cache.readFragment<SelectPantryItems_PantryItemFragment>(
      {
        fragment: SelectPantryItems_PantryItemFragmentDoc,
        fragmentName: 'SelectPantryItems_pantryItem',
        from: ref,
      },
    );
    if (!pantryItem) continue;
    const catalogId = pantryItem.item?.id ?? pantryItem.itemId;
    if (catalogId) {
      existingItemMap.set(catalogId, pantryItem.id);
      existingCatalogIds.add(catalogId);
    }
  }
  const index = { existingItemMap, existingCatalogIds };
  existingPantryIndexCache.set(itemsConnection, index);
  return index;
}

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

  // Map catalog item IDs to pantry item IDs for existing pantry items, via a
  // narrow `SelectPantryItems_pantryItem` fragment selecting only `id`,
  // `itemId`, and `item.id`.
  const { existingItemMap, existingCatalogIds } = buildExistingPantryIndex(
    apolloClient.cache,
    pantryData?.pantry?.itemsConnection,
  );

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

  // Gate on the absence of data, not on `loading`. Under `cache-and-network`
  // Apollo reports `loading: true` for the whole network leg on EVERY mount —
  // `nextFetchPolicy` lives on the ObservableQuery and useQuery builds a new
  // one each time — so stepping back into this screen re-showed the loader over
  // a warm cache, for as long as the request took. `useSelectableItems` keeps
  // only the user's overrides and re-derives the rest from `initialItems`, so a
  // late `pantryData` still lands the pre-selection without discarding a tap.
  if ((loading && !data) || (pantryLoading && !pantryData)) {
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
            {t('auth.tryAgain')}
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
            ...itemsToAdd.map(async item => {
              const id = generateEntityId();
              const result = await addItemToPantry({
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
              // The list is pre-filtered by existingCatalogIds, but a race
              // (another device adding the same item) can still surface the
              // DuplicatePantryItemError member. The item is already in the
              // pantry — exactly the onboarding goal — so classify it as a
              // per-item success-skip rather than leaving it unexamined.
              if (
                getPantryItemDuplicateFromResult(
                  result.data?.createPantryItem,
                  result.error,
                )
              ) {
                logger.info(
                  'SelectPantryItems: item already in pantry — skipped',
                  { itemId: item.id },
                );
              }
              return result;
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
          {t('labels.selected', { count: selectedItems.length })}
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
            ? t('labels.saving')
            : isFirstVisit
            ? selectedItems.length === 0
              ? t('labels.addItems')
              : t(
                  selectedItems.length === 1
                    ? 'onBoarding.addItemSingular'
                    : 'onBoarding.addItemPlural',
                  { count: selectedItems.length },
                )
            : hasChanges
            ? t('labels.saveChanges')
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
