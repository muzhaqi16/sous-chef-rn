import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useSelectableItems } from '#features/onboarding/hooks/useSelectableItems';
import { useOnboardingItems } from '#features/onboarding/hooks/useOnboardingItems';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';
import { useSelectedPantryId } from '#store/useAppStore';
import { Button } from '#components/molecules/Button';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

export const SelectPantryItems = () => {
  const { t } = useTranslation();
  useScreenTransition('SelectPantryItems');
  const { navigateToNextStep, navigateToPreviousStep } =
    useOnboardingNavigation();
  const selectedPantryId = useSelectedPantryId();

  const {
    items: catalogItems,
    loading,
    hasLoaded,
    failed,
    refetch,
  } = useOnboardingItems();

  const {
    existingItemMap,
    existingCatalogIds,
    loading: pantryLoading,
    hasLoaded: pantryHasLoaded,
    addItem,
    removeItem,
  } = usePantryItemSelection(selectedPantryId);

  const [isSaving, setIsSaving] = useState(false);

  const selectableItems = catalogItems.map(item => ({
    ...item,
    selected: existingCatalogIds.has(item.id),
  }));

  const { items, selectedItems, toggleItem, isMaxReached } = useSelectableItems(
    {
      initialItems: selectableItems,
      maxSelection: 100,
    },
  );

  // Gate on the absence of DATA, not on `loading`: under `cache-and-network`
  // Apollo reports `loading: true` for the whole network leg on every mount, so
  // `if (loading)` blanks a warm cache for the length of the request.
  // `useSelectableItems` keeps only the user's overrides, so a late pantry read
  // still lands the pre-selection without discarding a tap.
  if ((loading && !hasLoaded) || (pantryLoading && !pantryHasLoaded)) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.stockPantryTitle')}
        subtitle={t('onBoarding.stockPantrySubtitle')}
        onBack={() => navigateToPreviousStep('SelectPantryItems')}
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

  if (failed) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.stockPantryTitle')}
        subtitle={t('onBoarding.stockPantrySubtitle')}
        onBack={() => navigateToPreviousStep('SelectPantryItems')}
        onSkip={() => navigateToNextStep('SelectPantryItems')}
      >
        <View style={styles.errorContainer}>
          <Text
            role="error"
            tone="error"
            align="center"
            style={styles.errorText}
          >
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
      void executeWithLoadingState(
        async () => {
          await Promise.all([
            ...itemsToAdd.map(async item => {
              const outcome = await addItem(item.name, {
                item: { id: item.id },
                ...(item.displayUnit?.id && {
                  unit: { id: item.displayUnit.id },
                }),
                quantity: null,
                storage: {
                  storageState: StorageState.Ambient,
                  condition: ItemCondition.Good,
                },
                purchase: {
                  acquisitionMethod: AcquisitionMethod.Purchased,
                },
              });
              // A race with another device can still find the item stocked. It
              // is already in the pantry, the onboarding goal, so it is a skip.
              if (outcome.status === 'duplicate') {
                logger.info(
                  'SelectPantryItems: item already in pantry — skipped',
                  { itemId: item.id },
                );
              }
              return outcome;
            }),
            // `itemsToRemove` is drawn from the same index as the map.
            ...itemsToRemove.flatMap(catalogId => {
              const pantryItemId = existingItemMap.get(catalogId);
              return pantryItemId ? [removeItem(pantryItemId)] : [];
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
      onBack={() => navigateToPreviousStep('SelectPantryItems')}
      onSkip={() => navigateToNextStep('SelectPantryItems')}
      testID={onboardingTestIDs.selectPantryItemsScreen}
    >
      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          role="caption"
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
    marginBottom: theme.spacing.base,
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
}));
