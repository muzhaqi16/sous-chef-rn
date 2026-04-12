import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';

import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { Button } from '#components/base/Button';
import {
  useCreateShoppingListMutation,
  useGetShoppingListsLiteQuery,
} from '#generated';
import { extractNodes } from '#/utils/connectionUtils';
import { useAppStore, useUser, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { createShoppingListSchema } from '#utils/validation/onboarding';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';

/** Module-level async function for shopping list creation.
 *  Extracted from component body to avoid ThrowStatement-in-try-catch bailout. */
async function performCreateShoppingList(
  data: { shoppingListName: string },
  createShoppingList: (opts: { variables: any }) => Promise<any>,
  selectedHomeId: string | null,
  setSelectedShoppingListId: (id: string) => void,
  navigateToNextStep: (step: string) => void,
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
    throw new Error(payload?.message || 'Failed to create shopping list');
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
  const { data: listsData, loading: listsLoading } =
    useGetShoppingListsLiteQuery({
      skip: !user?.id,
      fetchPolicy: 'cache-and-network',
    });

  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
  const lists = extractNodes(listsData?.shoppingLists);
  const existingList =
    lists.find((list: { isDefault: boolean }) => list.isDefault) || lists[0];

  // Form setup
  const form = useForm<FormValues>({
    resolver: yupResolver(createShoppingListSchema),
    defaultValues: {
      shoppingListName: 'Weekly Groceries',
    },
  });

  const [createShoppingList] = useCreateShoppingListMutation();

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
          (error as any)?.message ||
            'An error occurred while creating the list.',
        );
      },
    );
  };

  // Loading state
  if (checkingExisting || listsLoading) {
    return (
      <OnBoardingWrapper
        title="Shopping Lists"
        subtitle="Checking your existing lists..."
        step={2}
        totalSteps={7}
        onSkip={() => skipToStep('SelectPantryItems')}
      >
        <View style={styles.loadingContainer}>
          <SousChefLoader
            size="small"
            showBrand={false}
            message="Checking your shopping lists..."
          />
        </View>
      </OnBoardingWrapper>
    );
  }

  // If list exists, show summary and continue button
  if (existingList) {
    return (
      <OnBoardingWrapper
        title="You're all set!"
        subtitle="Your shopping list is already configured"
        step={2}
        totalSteps={7}
        onSkip={() => skipToStep('SelectPantryItems')}
        testID="onboarding-create-shopping-list-screen"
      >
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text style={styles.resourceLabel}>Shopping List</Text>
            <Text style={styles.resourceName}>{existingList.name}</Text>
            {!!existingList.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>

          <Text style={styles.infoText}>
            This was already set up. You can continue to the next step or create
            additional ones later in settings.
          </Text>
        </View>

        <Button
          title="Continue"
          onPress={() => navigateToNextStep('CreateShoppingList')}
          variant="primary"
        />
      </OnBoardingWrapper>
    );
  }

  // No existing list - show create form
  return (
    <OnBoardingWrapper
      title="Create your shopping list"
      subtitle="You can add items to it later"
      step={2}
      totalSteps={7}
      onSkip={() => skipToStep('SelectPantryItems')}
      testID="onboarding-create-shopping-list-screen"
    >
      <DynamicFormFields<FormValues>
        fields={[
          {
            name: 'shoppingListName',
            label: 'Shopping List Name',
            placeholder: 'e.g. Weekly Groceries',
            component: BaseInput,
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
      />

      <Button
        title={isCreating ? 'Creating List...' : 'Create List'}
        onPress={form.handleSubmit(onSubmit)}
        variant="primary"
        disabled={isCreating}
      />

      {graphqlError ? (
        <Text style={styles.errorText}>{graphqlError}</Text>
      ) : null}
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  errorText: {
    color: theme.colors.error,
    marginTop: theme.spacing['3'],
    textAlign: 'center',
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
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.normal,
  },
}));
