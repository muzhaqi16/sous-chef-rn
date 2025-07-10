import React, {useState} from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import {OnBoardingWrapper} from '../../components/templates';
import {DynamicFormFields} from '../../components/molecules/DynamicFormFields';
import {BaseInput} from '../../components/atoms';
import {CreateShoppingListNavProp} from '../../navigation/types';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {yupResolver} from '@hookform/resolvers/yup';
import {useCreateShoppingListMutation} from '../../graphql/generated';
import * as yup from 'yup';

type FormValues = {shoppingListName: string};

export const CreateShoppingListScreen = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const firstName = 'Your';

  const [graphqlError, setGraphqlError] = useState<string | null>(null);

  const [createShoppingList] = useCreateShoppingListMutation({
    onCompleted: data => {
      if (data?.createShoppingList) {
        navigation.replace('OnBoarding', {screen: 'SelectPantryItems'});
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

  const {styles} = useStyles(stylesheet);
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
          .min(2, 'Shopping List Name must be at least 2 characters'),
      }),
    ),
    defaultValues: {shoppingListName: ''},
  });

  const onNext = handleSubmit(data => {
    createShoppingList({
      variables: {
        data: {
          name: data?.shoppingListName.trim(),
          isDefault: true, // Assuming you want to set this as default
          addTags: [
            'onboarding', // Example tag, you can modify or add more
          ], // Add any initial tags if needed
        },
      },
    });
    // save and navigate
  });
  return (
    <OnBoardingWrapper
      title="Let's create your list"
      subtitle="You can add more later"
      step={1}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onSkip={() =>
        navigation.replace('OnBoarding', {screen: 'SelectPantryItems'})
      }>
      <DynamicFormFields<FormValues>
        fields={[
          {
            name: 'shoppingListName',
            label: 'Shopping List Name',
            placeholder: `e.g. ${firstName}'s Shopping List`,
            component: BaseInput,
          },
        ]}
        control={control}
        errors={errors}
      />
      <TouchableOpacity onPress={onNext} style={styles.nextButton}>
        <Text style={styles.nextText}>Next</Text>
      </TouchableOpacity>
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
    color: theme.colors.error || 'red', // fallback to red if theme missing
    marginBottom: 12,
    textAlign: 'center',
  },
}));
