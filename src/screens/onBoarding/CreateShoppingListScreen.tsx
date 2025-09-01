import React, {useState, useEffect, useCallback} from 'react';
import {Text, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {StyleSheet} from 'react-native-unistyles';

import {OnBoardingWrapper} from '#components/templates';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';
import {BaseInput, Button} from '#components';
import {
  useCreateShoppingListMutation,
  useGetShoppingListsQuery,
} from '#generated';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import {useNavigationState, useSafeNavigation} from '#hooks';
import {createShoppingListSchema} from '#utils';

type FormValues = {
  shoppingListName: string;
};

export const CreateShoppingListScreen = () => {
  const {navigation, canGoBack, goBack} = useSafeNavigation();
  const {saveUserProgress} = useNavigationState();

  const {
    setOnBoardingStep,
    setSelectedShoppingListId,
    setUserNavigationState,
    user,
  } = useStore();

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
    if (user?.id) {
      setUserNavigationState(user.id, {
        onboardingProgress: OnBoardingSteps.selectPantryItems,
      });
    }

    setOnBoardingStep(OnBoardingSteps.selectPantryItems);
    saveUserProgress({
      onboardingProgress: OnBoardingSteps.selectPantryItems,
    });

    navigation.navigate('SelectPantryItems');
  }, [
    user?.id,
    setUserNavigationState,
    setOnBoardingStep,
    saveUserProgress,
    navigation,
  ]);

  // Check for existing shopping lists
  useEffect(() => {
    let isMounted = true;

    const checkExistingLists = async () => {
      if (listsLoading || !user?.id) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        if (lists.length > 0) {
          const defaultList = lists.find(list => list.isDefault) || lists[0];
          console.log('Found existing shopping list:', defaultList.id);
          setSelectedShoppingListId(defaultList.id);

          // Skip to next step
          console.log(
            'Shopping list exists, skipping to pantry items selection',
          );
          navigateToNext();
          return;
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
  }, [
    lists,
    listsLoading,
    user?.id,
    navigateToNext,
    setSelectedShoppingListId,
  ]);

  // Submit handler
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
          },
        },
      });

      if (response.data?.createShoppingList) {
        console.log(
          'Shopping list created:',
          response.data.createShoppingList.id,
        );
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

  // Handlers
  const handleSkip = useCallback(() => {
    console.log('Skipping shopping list creation');
    navigateToNext();
  }, [navigateToNext]);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      goBack();
    }
  }, [canGoBack, goBack]);

  // Loading state
  if (checkingExisting || listsLoading) {
    return (
      <OnBoardingWrapper
        title="Create your shopping list"
        subtitle="Checking your existing lists..."
        step={2}
        totalSteps={5}
        onBack={handleBack}
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
      title="Create your shopping list"
      subtitle="You can add items to it later"
      step={2}
      totalSteps={5}
      onBack={handleBack}
      onSkip={handleSkip}>
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
        title={isCreating ? 'Creating List...' : 'Next'}
        onPress={form.handleSubmit(onSubmit)}
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
        disabled={isCreating}
      />

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
}));
