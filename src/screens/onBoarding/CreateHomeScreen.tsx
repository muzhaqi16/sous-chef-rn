import React, {useState} from 'react';
import {Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import {OnBoardingWrapper} from '#components/templates';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';
import {BaseInput, Button} from '#components';
import {CreateHomeNavProp} from '#navigation/types';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {yupResolver} from '@hookform/resolvers/yup';
import {
  HomeType,
  useCreateHomeMutation,
  useCreatePantryMutation,
} from '#generated';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import * as yup from 'yup';

type FormValues = {
  homeName: string;
  pantryName: string;
};

export const CreateHomeScreen = () => {
  const navigation = useNavigation<CreateHomeNavProp>();
  const {setOnBoardingStep, setSelectedHomeId, setSelectedPantryId, user} =
    useStore();
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const {styles} = useStyles(stylesheet);

  const [createPantry] = useCreatePantryMutation({
    onError: error => {
      console.error('Failed to create pantry:', error);
    },
  });

  const [createHome] = useCreateHomeMutation({
    onCompleted: async data => {
      if (data?.createHome) {
        setGraphqlError(null);
        // Store the home ID
        setSelectedHomeId(data.createHome.id);

        try {
          // Create the default pantry for this home
          const pantryResult = await createPantry({
            variables: {
              input: {
                homeId: data.createHome.id,
                name: control._formValues.pantryName || 'My Pantry',
                description: 'Default pantry',
                isDefault: true,
                tags: ['default', 'onboarding'],
              },
            },
          });

          if (pantryResult.data?.createPantry) {
            setSelectedPantryId(pantryResult.data.createPantry.id);
          }
        } catch (error) {
          console.error('Failed to create pantry:', error);
          // Continue anyway - pantry can be created later
        }

        // Navigate to the next step
        setOnBoardingStep(OnBoardingSteps.createHome);
        navigation.replace('CreateShoppingList');
      } else {
        setGraphqlError('Failed to create home');
      }
    },
    onError: error => {
      setGraphqlError(
        error.message || 'An error occurred while creating the home',
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
        homeName: yup
          .string()
          .required('Home name is required')
          .min(2, 'Home name must be at least 2 characters')
          .max(50, 'Home name must be less than 50 characters'),
        pantryName: yup
          .string()
          .required('Pantry name is required')
          .min(2, 'Pantry name must be at least 2 characters')
          .max(50, 'Pantry name must be less than 50 characters'),
      }),
    ),
    defaultValues: {
      homeName: '',
      pantryName: 'Kitchen Pantry',
    },
  });

  const onNext = handleSubmit(data => {
    createHome({
      variables: {
        input: {
          name: data.homeName.trim(),
          description: 'Created during onboarding',
          type: HomeType.Household, // Default home type
          isPublic: false,
          allowJoinCode: true, // Allow others to join via code
          tags: ['onboarding'],
        },
      },
    });
  });

  return (
    <OnBoardingWrapper
      title="Welcome! Let's set up your home"
      subtitle="Create your home and pantry to get started"
      step={1}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      onSkip={() => {
        // Skip to shopping list creation
        navigation.replace('CreateShoppingList');
      }}>
      <DynamicFormFields<FormValues>
        fields={[
          {
            name: 'homeName',
            label: 'Home Name',
            placeholder: `e.g. Smith Family Home`,
            component: BaseInput,
          },
          {
            name: 'pantryName',
            label: 'Default Pantry Name',
            placeholder: `e.g. Kitchen Pantry`,
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
