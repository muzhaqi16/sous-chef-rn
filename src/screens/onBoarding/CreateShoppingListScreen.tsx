import React, {useState, useEffect, useCallback} from 'react';
import {Text, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {StyleSheet} from 'react-native-unistyles';

import {
  OnBoardingWrapper,
  DynamicFormFields,
  BaseInput,
  Button,
} from '#components';
import {
  useCreateShoppingListMutation,
  useGetShoppingListsQuery,
} from '#generated';
import {useStore} from '#store';
import {useOnboardingFlow, useNavigationFlow} from '#hooks';
import {createShoppingListSchema} from '#utils';

type FormValues = {
  shoppingListName: string;
};

export const CreateShoppingListScreen = () => {
  const {progressToNextStep} = useOnboardingFlow();
  const {navigateWithinStack, goBack, canGoBack} = useNavigationFlow();

  const {setSelectedShoppingListId, user} = useStore();

  // State management
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // GraphQL query
  const {data: listsData, loading: listsLoading} = useGetShoppingListsQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const lists = listsData?.shoppingLists || [];
  const existingList = lists.find(list => list.isDefault) || lists[0];

  // GraphQL mutation
  const [createShoppingList] = useCreateShoppingListMutation();

  // Form setup
  const form = useForm<FormValues>({
    resolver: yupResolver(createShoppingListSchema),
    defaultValues: {
      shoppingListName: 'Weekly Groceries',
    },
  });

  // Memoized navigation handler
  const navigateToNext = useCallback(() => {
    const nextScreen = progressToNextStep();
    if (nextScreen) {
      navigateWithinStack(nextScreen);
    }
  }, [progressToNextStep, navigateWithinStack]);

  // Check existing lists without auto-navigation
  useEffect(() => {
    let isMounted = true;

    const checkExistingLists = async () => {
      if (listsLoading || !user?.id) return;

      try {
        // Small delay to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        // If list exists, set it as selected but don't auto-navigate
        if (existingList) {
          setSelectedShoppingListId(existingList.id);
        }

        if (isMounted) {
          setCheckingExisting(false);
        }
      } catch (error) {
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
            isDefault: !existingList, // Only set as default if no existing list
            tags: ['onboarding', 'groceries'],
          },
        },
      });

      if (response.data?.createShoppingList) {
        setSelectedShoppingListId(response.data.createShoppingList.id);
        navigateToNext();
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

  // Skip handler - uses existing list
  const handleSkip = useCallback(() => {
    if (existingList) {
      // Make sure existing list is selected
      setSelectedShoppingListId(existingList.id);
    }
    navigateToNext();
  }, [existingList, setSelectedShoppingListId, navigateToNext]);

  // Loading state
  if (checkingExisting || listsLoading) {
    return (
      <OnBoardingWrapper
        title="Shopping Lists"
        subtitle="Checking your existing lists..."
        step={2}
        totalSteps={6}
        onSkip={handleSkip}>
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

  return (
    <OnBoardingWrapper
      title={existingList ? "You're all set!" : 'Create your shopping list'}
      subtitle={
        existingList
          ? `You already have "${existingList.name}"`
          : 'You can add items to it later'
      }
      step={2}
      totalSteps={6}
      onSkip={handleSkip}>
      {existingList ? (
        <>
          {/* Show existing list info */}
          <View style={styles.existingListContainer}>
            <View style={styles.existingListCard}>
              <Text style={styles.existingListTitle}>Current List</Text>
              <Text style={styles.existingListName}>{existingList.name}</Text>
              {existingList.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
            </View>

            <Text style={styles.orText}>— OR —</Text>

            <Text style={styles.createNewText}>Create an additional list:</Text>
          </View>

          {/* Form to create additional list */}
          <DynamicFormFields<FormValues>
            fields={[
              {
                name: 'shoppingListName',
                label: 'New List Name',
                placeholder: 'e.g. Party Supplies',
                component: BaseInput,
              },
            ]}
            control={form.control}
            errors={form.formState.errors}
          />

          <View style={styles.buttonContainer}>
            <Button
              title="Continue with existing"
              onPress={handleSkip}
              btnStyle={styles.skipButton}
              txtStyle={styles.skipText}
            />

            <Button
              title={isCreating ? 'Creating...' : 'Create New List'}
              onPress={form.handleSubmit(onSubmit)}
              btnStyle={styles.createButton}
              txtStyle={styles.createText}
              disabled={isCreating}
            />
          </View>
        </>
      ) : (
        <>
          {/* No existing list - show create form */}
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
            btnStyle={styles.nextButton}
            txtStyle={styles.nextText}
            disabled={isCreating}
          />
        </>
      )}

      {graphqlError && <Text style={styles.errorText}>{graphqlError}</Text>}
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
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
    color: theme.colors.error,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingIndicator: {
    color: theme.colors.primary,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  existingListContainer: {
    marginBottom: 20,
  },
  existingListCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  existingListTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  existingListName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  defaultBadgeText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginVertical: 16,
  },
  createNewText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  skipButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
