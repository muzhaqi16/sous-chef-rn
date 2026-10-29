import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import { useOnboardingNavigation } from '#features/onboarding/screens/useOnboardingNavigation';
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
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';

/** Where a staple is kept, each a group of its own; the rest is the pantry. */
const STAPLE_GROUPS: readonly {
  state: StorageState;
  labelKey: TranslationKey;
}[] = [
  {
    state: StorageState.Refrigerated,
    labelKey: 'storageStateShort.REFRIGERATED',
  },
  { state: StorageState.Frozen, labelKey: 'storageStateShort.FROZEN' },
  { state: StorageState.Ambient, labelKey: 'storageStateShort.AMBIENT' },
];

const groupOf = (state: StorageState): StorageState =>
  state === StorageState.Refrigerated || state === StorageState.Frozen
    ? state
    : StorageState.Ambient;

/** The receipt step's alternative: foods picked by where they are kept. */
export const SelectPantryItems = () => {
  const { t } = useTranslation();
  const { recordStapleItems } = useRecordOnboardingProgress();
  useScreenTransition('Staples');
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
        onBack={() => navigateToPreviousStep('Staples')}
        onSkip={() => navigateToNextStep('Staples')}
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
        onBack={() => navigateToPreviousStep('Staples')}
        onSkip={() => navigateToNextStep('Staples')}
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
            ...itemsToAdd.map(item =>
              addItem(item.name, {
                item: { id: item.id },
                ...(item.displayUnit?.id && {
                  unit: { id: item.displayUnit.id },
                }),
                quantity: null,
                storage: {
                  storageState: item.storageState,
                  condition: ItemCondition.Good,
                },
                purchase: {
                  acquisitionMethod: AcquisitionMethod.Purchased,
                },
              }),
            ),
            // `itemsToRemove` is drawn from the same index as the map.
            ...itemsToRemove.flatMap(catalogId => {
              const pantryItemId = existingItemMap.get(catalogId);
              return pantryItemId ? [removeItem(pantryItemId)] : [];
            }),
          ]);
          recordStapleItems(itemsToAdd.length);
          navigateToNextStep('Staples');
        },
        setIsSaving,
        error => {
          errorService.reportError(error, {
            operation: 'SelectPantryItems.updatePantryItems',
          });
          navigateToNextStep('Staples');
        },
      );
      return;
    }
    navigateToNextStep('Staples');
  };

  return (
    <OnBoardingWrapper
      title={t('onBoarding.stockPantryTitle')}
      subtitle={t('onBoarding.stockPantrySubtitleOptional')}
      onBack={() => navigateToPreviousStep('Staples')}
      onSkip={() => navigateToNextStep('Staples')}
      primaryAction={
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
      }
      testID={onboardingTestIDs.selectPantryItemsScreen}
    >
      <View style={styles.listContent}>
        <Text role="caption" tone="secondary" align="center">
          {t('labels.selected', { count: selectedItems.length })}
        </Text>
        {STAPLE_GROUPS.map(group => {
          const inGroup = items.filter(
            item => groupOf(item.storageState) === group.state,
          );
          return inGroup.length > 0 ? (
            <View
              key={group.state}
              style={styles.group}
              testID={onboardingTestIDs.staplesGroup(group.state)}
            >
              <Text role="bodyStrong">{t(group.labelKey)}</Text>
              <View style={styles.chipContainer}>
                {inGroup.map(item => (
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
            </View>
          ) : null;
        })}
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  listContent: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  group: {
    gap: theme.spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
