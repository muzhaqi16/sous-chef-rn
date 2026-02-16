import React, { useState, useEffect } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
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
import {
  useAppStore,
  selectUser,
  selectSelectedHomeId,
} from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { createShoppingListSchema } from '#utils/validation/onboarding';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

type FormValues = {
  shoppingListName: string;
};

export const CreateShoppingListScreen = () => {
  useScreenTransition('CreateShoppingListScreen');
  const { navigateToNextStep, skipToStep } = useOnboardingNavigation();

  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const user = useAppStore(selectUser);
  const selectedHomeId = useAppStore(selectSelectedHomeId);

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

  // GraphQL mutation
  const [createShoppingList] = useCreateShoppingListMutation();

  // Form setup
  const form = useForm<FormValues>({
    resolver: yupResolver(createShoppingListSchema),
    defaultValues: {
      shoppingListName: 'Weekly Groceries',
    },
  });

  // Check existing lists
  useEffect(() => {
    let isMounted = true;

    const checkExistingLists = async () => {
      if (listsLoading || !user?.id) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        // If list exists, set it as selected
        if (existingList) {
          setSelectedShoppingListId(existingList.id);
        }

        if (isMounted) {
          setCheckingExisting(false);
        }
      } catch {
        if (isMounted) {
          setCheckingExisting(false);
        }
      }
    };

    checkExistingLists();

    return () => {
      isMounted = false;
    };
  }, [listsLoading, user?.id, existingList, setSelectedShoppingListId]);

  // Submit handler - creates new list
  const onSubmit = async (data: FormValues) => {
    setIsCreating(true);
    setGraphqlError(null);

    try {
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

      const newList = response.data?.createShoppingList?.shoppingList;
      if (newList) {
        setSelectedShoppingListId(newList.id);
        navigateToNextStep('CreateShoppingList');
      } else {
        throw new Error('Failed to create shopping list');
      }
    } catch (error: any) {
      const errorMessage =
        error.message || 'An error occurred while creating the list.';
      console.error('Shopping list creation error:', errorMessage);
      setGraphqlError(errorMessage);
    } finally {
      setIsCreating(false);
    }
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
          <ActivityIndicator
            size="large"
            color={styles.loadingIndicator.color}
          />
          <Text style={styles.loadingText}>
            Checking your shopping lists...
          </Text>
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
            {existingList.isDefault && (
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

      {graphqlError && <Text style={styles.errorText}>{graphqlError}</Text>}
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
  loadingIndicator: {
    color: theme.colors.primary,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
