import React, {useState} from 'react';
import {Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import {OnBoardingWrapper} from '#components/templates';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';
import {BaseInput, Button} from '#components';
import {CreateShoppingListNavProp} from '#navigation/types';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {yupResolver} from '@hookform/resolvers/yup';
import {useCreateShoppingListMutation} from '#generated';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import * as yup from 'yup';

type FormValues = {shoppingListName: string};

export const CreateShoppingListScreen = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const {setOnBoardingStep, setSelectedShoppingListId} = useStore();
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const {styles} = useStyles(stylesheet);

  const [createShoppingList] = useCreateShoppingListMutation({
    onCompleted: data => {
      if (data?.createShoppingList) {
        setGraphqlError(null);
        // Set the selected shopping list ID in the store
        setSelectedShoppingListId(data.createShoppingList.id);
        // Navigate to the next step in the onboarding process
        setOnBoardingStep(OnBoardingSteps.createShoppingList);
        navigation.replace('SelectPantryItems');
      } else {
        setGraphqlError('Failed to create shopping list');
      }
    },
    onError: error => {
      setGraphqlError(
        error.message || 'An error occurred while creating the shopping list',
      );
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

  return (
    <OnBoardingWrapper
      title="Create your shopping list"
      subtitle="You can add items to it later"
      step={2}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      onSkip={() => {
        setOnBoardingStep(OnBoardingSteps.createShoppingList);
        navigation.replace('SelectPantryItems');
      }}>
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
        title="Next"
        onPress={onNext}
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
      />
      {graphqlError && <Text style={styles.errorText}>{graphqlError}</Text>}
    </OnBoardingWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
}));
