// screens/OnBoarding/CreateShoppingListScreen.tsx
import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import {OnBoardingWrapper} from '../../components/templates';
import {DynamicFormFields} from '../../components/molecules/DynamicFormFields';
import {BaseInput} from '../../components/atoms';
import {CreateShoppingListNavProp} from '../../navigation/types';

type FormValues = {shoppingListName: string};

export const CreateShoppingListScreen = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormValues>({
    defaultValues: {shoppingListName: ''},
  });

  const onNext = handleSubmit(data => {
    // save and navigate
  });

  return (
    <OnBoardingWrapper
      title="Let's create your list"
      subtitle="You can add more later"
      step={1}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.replace('Home', {screen: 'ShoppingList'})}>
      <DynamicFormFields<FormValues>
        fields={[
          {
            name: 'shoppingListName',
            label: 'Shopping List Name',
            component: BaseInput,
          },
        ]}
        control={control}
        errors={errors}
      />
      <TouchableOpacity onPress={onNext}>
        <Text>Next</Text>
      </TouchableOpacity>
    </OnBoardingWrapper>
  );
};
