import React, {useState} from 'react';
import {Text, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {OnBoardingWrapper} from '#components/templates';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';
import {BaseInput, Button} from '#components';
import {CreateShoppingListNavProp} from '#navigation/types';
import {StyleSheet} from 'react-native-unistyles';
import {yupResolver} from '@hookform/resolvers/yup';
import {
  useCreateShoppingListMutation,
  useGetShoppingListsQuery,
} from '#generated';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import * as yup from 'yup';
import {useOnboardingSkip} from '#hooks';

type FormValues = {shoppingListName: string};

export const CreateShoppingListScreen = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const {setOnBoardingStep, setSelectedShoppingListId, user} = useStore();
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Check for existing shopping lists
  const {data: listsData, loading: listsLoading} = useGetShoppingListsQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const lists = listsData?.shoppingLists || [];

  // Use the hook to handle skipping - replaces the useFocusEffect logic
  const isCheckingExisting = useOnboardingSkip(
    {data: lists, loading: listsLoading},
    lists,
    OnBoardingSteps.createHome,
    'SelectPantryItems',
    setSelectedShoppingListId,
  );
  const [createShoppingList] = useCreateShoppingListMutation({
    onCompleted: data => {
      if (data?.createShoppingList) {
        setGraphqlError(null);
        console.log(
          'Shopping list created successfully:',
          data.createShoppingList.id,
        );

        // Set the selected shopping list ID in the store
        setSelectedShoppingListId(data.createShoppingList.id);

        // Navigate to the next step in the onboarding process
        setOnBoardingStep(OnBoardingSteps.createShoppingList);
        setIsCreating(false);
        navigation.replace('SelectPantryItems');
      } else {
        setGraphqlError('Failed to create shopping list');
        setIsCreating(false);
      }
    },
    onError: error => {
      setGraphqlError(
        error.message || 'An error occurred while creating the shopping list',
      );
      setIsCreating(false);
    },
  });

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormValues>({
    resolver: yupResolver(
      yup.object().shape({
        shoppingListName: yup
          .string()
          .required('Shopping List Name is required')
          .min(2, 'Shopping List Name must be at least 2 characters')
          .max(50, 'Shopping List Name must be less than 50 characters'),
      }),
    ),
    defaultValues: {shoppingListName: 'Weekly Groceries'},
  });

  const onNext = handleSubmit(data => {
    console.log('Creating shopping list with data:', data);
    setIsCreating(true);
    setGraphqlError(null);

    createShoppingList({
      variables: {
        input: {
          name: data.shoppingListName.trim(),
          description: 'Created during onboarding',
          isDefault: true,
          tags: ['onboarding', 'groceries'],
        },
      },
    });
  });

  const handleSkip = () => {
    console.log('Skipping shopping list creation');
    setOnBoardingStep(OnBoardingSteps.createShoppingList);
    navigation.replace('SelectPantryItems');
  };

  const handleBack = () => {
    // Only allow going back if user came from a valid previous step
    // In normal flow, this should not be called due to gestureEnabled: false
    console.log('Attempting to go back from CreateShoppingList');
    navigation.goBack();
  };

  // Show loading if we're checking for existing lists
  if (isCheckingExisting) {
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
            placeholder: `e.g. Weekly Groceries`,
            component: BaseInput,
          },
        ]}
        control={control}
        errors={errors}
      />

      <Button
        title={isCreating ? 'Creating List...' : 'Next'}
        onPress={onNext}
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
    color: theme.colors.error || 'red',
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
