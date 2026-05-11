import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { Button } from '#components/base/Button';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  CreateShoppingListDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { useAppStore, useUser, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { createShoppingListSchema } from '#utils/validation/onboarding';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';

/** Module-level async function for shopping list creation.
 *  Extracted from component body to avoid ThrowStatement-in-try-catch bailout. */
async function performCreateShoppingList(
  data: { shoppingListName: string },
  createShoppingList: (opts: { variables: any }) => Promise<any>,
  selectedHomeId: string | null,
  setSelectedShoppingListId: (id: string) => void,
  navigateToNextStep: (step: string) => void,
  fallbackErrorMessage: string,
): Promise<void> {
  const response = await createShoppingList({
    variables: {
      input: {
        name: data.shoppingListName.trim(),
        description: 'Created during onboarding',
        isDefault: true,
        tags: ['onboarding', 'groceries'],
        homeId: selectedHomeId || undefined,
      },
    },
  });

  console.log('CreateShoppingList response:', response);

  if (response.error) {
    errorService.reportError(response.error, {
      operation: 'CreateShoppingList.graphqlError',
    });
    throw new Error(response.error.message);
  }

  const payload = response.data?.createShoppingList;

  if (payload?.success) {
    if (payload.shoppingList) {
      setSelectedShoppingListId(payload.shoppingList.id);
    }
    navigateToNextStep('CreateShoppingList');
  } else {
    throw new Error(payload?.message || fallbackErrorMessage);
  }
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
  const { data: listsData, loading: listsLoading } = useQuery(
    GetShoppingListsLiteDocument,
    {
      skip: !user?.id,
    },
  );

  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
  const lists = extractNodes(listsData?.shoppingLists);
  const existingList =
    lists.find((list: { isDefault: boolean }) => list.isDefault) || lists[0];

  // Form setup
  const form = useForm<FormValues>({
    resolver: yupResolver(createShoppingListSchema),
    defaultValues: {
      shoppingListName: t('onBoarding.defaultShoppingListName'),
    },
  });

  const [createShoppingList] = useMutation(CreateShoppingListDocument);

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
          t('errors.createShoppingListFailed'),
        ),
      setIsCreating,
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'CreateShoppingList.submit',
        });
        setGraphqlError(
          (error as any)?.message || t('onBoarding.createShoppingListError'),
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
        step={2}
        totalSteps={7}
        onSkip={() => skipToStep('SelectPantryItems')}
      >
        <View style={styles.loadingContainer}>
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
        title={t('onBoarding.allSet')}
        subtitle={t('onBoarding.shoppingListConfigured')}
        step={2}
        totalSteps={7}
        onSkip={() => skipToStep('SelectPantryItems')}
        testID="onboarding-create-shopping-list-screen"
      >
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text size="xs" tone="secondary" style={styles.resourceLabel}>
              {t('labels.shoppingList')}
            </Text>
            <Text size="lg" weight="semibold">
              {existingList.name}
            </Text>
            {!!existingList.isDefault && (
              <View style={styles.defaultBadge}>
                <Text
                  size="xs"
                  weight="semibold"
                  tone="accent"
                  style={styles.defaultBadgeText}
                >
                  {t('labels.default')}
                </Text>
              </View>
            )}
          </View>

          <Text
            size="sm"
            tone="secondary"
            align="center"
            lineHeight="normal"
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
      step={2}
      totalSteps={7}
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
        onPress={form.handleSubmit(onSubmit)}
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
    marginTop: theme.spacing['3'],
  },
  loadingContainer: {
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
    padding: theme.spacing.md,
    borderWidth: 1,
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
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  defaultBadgeText: {
    textTransform: 'uppercase',
  },
  infoText: {
    marginTop: theme.spacing.md,
  },
}));
