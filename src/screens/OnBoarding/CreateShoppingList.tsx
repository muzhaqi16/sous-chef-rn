import React, {useState} from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import {OnBoardingWrapper} from '../../components/templates';
import {DynamicFormFields} from '../../components/molecules/DynamicFormFields';
import {BaseInput} from '../../components/atoms';
import {useStore} from '../../store/useStore';
import {CreateShoppingListNavProp} from '../../navigation/types';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {CREATE_SHOPPING_LIST} from '../../api/graphql/mutations/shoppingList';
import {useMutation} from '@apollo/client';
import {yupResolver} from '@hookform/resolvers/yup';
import * as yup from 'yup';

type FormValues = {shoppingListName: string};

export const CreateShoppingListScreen = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const firstName = useStore(
    store => store?.user?.profile?.firstName || 'Your',
  );
  const setDefaultShoppingList = useStore(s => s.setDefaultShoppingList);

  const [graphqlError, setGraphqlError] = useState<string | null>(null);

  const [createShoppingList, {error}] = useMutation(CREATE_SHOPPING_LIST, {
    onCompleted: ({createShoppingList}) => {
      console.log('Shopping List Created:', createShoppingList);
      setDefaultShoppingList(createShoppingList); // Set the created list as default
      setGraphqlError(null); // Reset error on success

      navigation.replace('OnBoarding', {screen: 'SelectPantryItems'});
    },
    onError: error => {
      // Check for network error or graphql error
      if (error.networkError) {
        setGraphqlError('Network error: Please check your connection.');
      } else if (error.graphQLErrors.length > 0) {
        setGraphqlError(error.graphQLErrors[0].message);
      } else {
        setGraphqlError('An unknown error occurred.');
      }
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
          tags: [
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
