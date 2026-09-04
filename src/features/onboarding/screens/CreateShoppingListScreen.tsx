import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { t as tGlobal, useTranslation } from '#/i18n';

import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useAppStore, useUser, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { createShoppingListSchema } from '#features/onboarding/utils/validation';
import { logValidationErrors } from '#utils/validation/common';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService, localizedErrorMessage } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { Text } from '#components/atoms/Text';

/** Module-level async function for shopping list creation.
 *  Extracted from component body to avoid ThrowStatement-in-try-catch bailout. */
async function performCreateShoppingList(
  data: { shoppingListName: string },
  createShoppingList: (input: {
    name: string;
    description?: string;
    isDefault?: boolean;
    tags?: string[];
    homeId?: string;
  }) => Promise<{ id: string }>,
  selectedHomeId: string | null,
  setSelectedShoppingListId: (id: string) => void,
  navigateToNextStep: (step: string) => void,
): Promise<void> {
  const shoppingList = await createShoppingList({
    name: data.shoppingListName.trim(),
    description: tGlobal('onBoarding.createdDuringOnboarding'),
    isDefault: true,
    tags: ['onboarding', 'groceries'],
    homeId: selectedHomeId || undefined,
  });

  setSelectedShoppingListId(shoppingList.id);
  navigateToNextStep('CreateShoppingList');
}

/** Module-level helper to sync existing list state */
function syncExistingListState(
  existingList: { id: string } | undefined,
  setSelectedShoppingListId: (id: string) => void,
  setCheckingExisting: (v: boolean) => void,
) {
  if (existingList) {
    setSelectedShoppingListId(existingList.id);
  }
  setCheckingExisting(false);
}

type FormValues = {
  shoppingListName: string;
};

export const CreateShoppingListScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('CreateShoppingListScreen');
  const { navigateToNextStep, skipToStep } = useOnboardingNavigation();

  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const user = useUser();
  const selectedHomeId = useSelectedHomeId();

  // State management
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // GraphQL query - uses lightweight query for list metadata only
  const { lists, loading: listsLoading } = useShoppingListsLite({
    skip: !user?.id,
  });

  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
  const existingList =
    lists.find((list: { isDefault: boolean }) => list.isDefault) || lists[0];

  // Form setup
  const form = useForm<FormValues>({
    resolver: yupResolver(createShoppingListSchema),
    defaultValues: {
      shoppingListName: t('onBoarding.defaultShoppingListName'),
    },
  });

  const { createShoppingList } = useCreateShoppingList(
    t('errors.createShoppingListFailed'),
  );

  // Check existing lists
  useEffect(() => {
    if (listsLoading || !user?.id) return;

    syncExistingListState(
      existingList,
      setSelectedShoppingListId,
      setCheckingExisting,
    );
  }, [listsLoading, user?.id, existingList, setSelectedShoppingListId]);

  // Submit handler - creates new list
  const onSubmit = (data: FormValues) => {
    setGraphqlError(null);

    executeWithLoadingState(
      () =>
        performCreateShoppingList(
          data,
          createShoppingList,
          selectedHomeId,
          setSelectedShoppingListId,
          navigateToNextStep,
        ),
      setIsCreating,
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'CreateShoppingList.submit',
        });
        setGraphqlError(
          localizedErrorMessage(error, t('onBoarding.createShoppingListError')),
        );
      },
    );
  };

  // Loading state
  if (checkingExisting || listsLoading) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.shoppingListsTitle')}
        subtitle={t('onBoarding.checkingExistingLists')}
        step={3}
        totalSteps={8}
        onSkip={() => skipToStep('SelectPantryItems')}
      >
        <View style={styles.centeredSpinner}>
          <SousChefLoader
            size="small"
            showBrand={false}
            message={t('onBoarding.checkingYourShoppingLists')}
          />
        </View>
      </OnBoardingWrapper>
    );
  }

  // If list exists, show summary and continue button
  if (existingList) {
    return (
      <OnBoardingWrapper
        title={t('labels.youReAllSet')}
        subtitle={t('onBoarding.shoppingListConfigured')}
        step={3}
        totalSteps={8}
        onSkip={() => skipToStep('SelectPantryItems')}
        testID="onboarding-create-shopping-list-screen"
      >
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text role="caption" tone="secondary" style={styles.resourceLabel}>
              {t('labels.shoppingList')}
            </Text>
            <Text role="heading">{existingList.name}</Text>
            {!!existingList.isDefault && (
              <View style={styles.defaultBadge}>
                <Text
                  role="label"
                  tone="accent"
                  style={styles.defaultBadgeText}
                >
                  {t('labels.default')}
                </Text>
              </View>
            )}
          </View>

          <Text
            role="caption"
            tone="secondary"
            align="center"
            style={styles.infoText}
          >
            {t('onBoarding.shoppingListAlreadySetUp')}
          </Text>
        </View>

        <Button
          title={t('labels.continue')}
          onPress={() => navigateToNextStep('CreateShoppingList')}
          variant="primary"
        />
      </OnBoardingWrapper>
    );
  }

  // No existing list - show create form
  return (
    <OnBoardingWrapper
      title={t('onBoarding.createShoppingListTitle')}
      subtitle={t('onBoarding.createShoppingListSubtitle')}
      step={3}
      totalSteps={8}
      onSkip={() => skipToStep('SelectPantryItems')}
      testID="onboarding-create-shopping-list-screen"
    >
      <DynamicFormFields<FormValues>
        fields={[
          {
            name: 'shoppingListName',
            label: t('onBoarding.shoppingListName'),
            placeholder: t('onBoarding.shoppingListPlaceholder'),
            component: BaseInput,
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
      />

      <Button
        title={
          isCreating ? t('onBoarding.creatingList') : t('onBoarding.createList')
        }
        onPress={form.handleSubmit(onSubmit, logValidationErrors)}
        variant="primary"
        disabled={isCreating}
      />

      {graphqlError ? (
        <Text tone="error" align="center" style={styles.errorText}>
          {graphqlError}
        </Text>
      ) : null}
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  errorText: {
    marginTop: theme.spacing.base,
  },
  centeredSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  existingResourcesContainer: {
    marginVertical: theme.spacing.lg,
  },
  resourceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  resourceLabel: {
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defaultBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.primary,
  },
  defaultBadgeText: {
    textTransform: 'uppercase',
  },
  infoText: {
    marginTop: theme.spacing.md,
  },
}));
