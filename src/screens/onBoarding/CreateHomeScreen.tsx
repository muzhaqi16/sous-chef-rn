// src/screens/onBoarding/CreateHomeScreen.tsx
import React, {useState, useEffect} from 'react';
import {Text, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
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
  useGetHomesQuery,
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
  const [isCreating, setIsCreating] = useState(false);
  const {styles} = useStyles(stylesheet);

  // Check for existing homes
  const {
    data: homesData,
    loading: homesLoading,
    refetch: refetchHomes,
  } = useGetHomesQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const homes = homesData?.homes || [];

  // Check if user already has a home when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('CreateHomeScreen focused, checking for existing homes...');
      if (!homesLoading && homes.length > 0) {
        console.log('User already has homes, skipping to next step');
        // Set the first home as selected
        setSelectedHomeId(homes[0].id);
        setOnBoardingStep(OnBoardingSteps.createHome);
        navigation.replace('CreateShoppingList');
      }
    }, [homes, homesLoading, setSelectedHomeId, setOnBoardingStep, navigation]),
  );

  const [createPantry] = useCreatePantryMutation({
    onError: error => {
      console.error('Failed to create pantry:', error);
    },
  });

  const [createHome] = useCreateHomeMutation({
    onCompleted: async data => {
      if (data?.createHome) {
        setGraphqlError(null);
        console.log('Home created successfully:', data.createHome.id);

        // Store the home ID
        setSelectedHomeId(data.createHome.id);

        try {
          // Create the default pantry for this home
          console.log('Creating default pantry...');
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
            console.log(
              'Pantry created successfully:',
              pantryResult.data.createPantry.id,
            );
            setSelectedPantryId(pantryResult.data.createPantry.id);
          }
        } catch (error) {
          console.error('Failed to create pantry:', error);
          // Continue anyway - pantry can be created later
        }

        // Update onboarding step and navigate
        setOnBoardingStep(OnBoardingSteps.createHome);
        setIsCreating(false);
        navigation.replace('CreateShoppingList');
      } else {
        setGraphqlError('Failed to create home');
        setIsCreating(false);
      }
    },
    onError: error => {
      setGraphqlError(
        error.message || 'An error occurred while creating the home',
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
    console.log('Creating home with data:', data);
    setIsCreating(true);
    setGraphqlError(null);

    createHome({
      variables: {
        input: {
          name: data.homeName.trim(),
          description: 'Created during onboarding',
          type: HomeType.Household,
          isPublic: false,
          allowJoinCode: true,
          tags: ['onboarding'],
        },
      },
    });
  });

  const handleSkip = () => {
    console.log('Skipping home creation');
    setOnBoardingStep(OnBoardingSteps.createHome);
    navigation.replace('CreateShoppingList');
  };

  // Show loading if we're checking for existing homes
  if (homesLoading) {
    return (
      <OnBoardingWrapper
        title="Welcome! Let's set up your home"
        subtitle="Checking your existing setup..."
        step={1}
        totalSteps={5}
        onSkip={handleSkip}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={styles.loadingIndicator.color}
          />
          <Text style={styles.loadingText}>Checking your homes...</Text>
        </View>
      </OnBoardingWrapper>
    );
  }

  return (
    <OnBoardingWrapper
      title="Welcome! Let's set up your home"
      subtitle="Create your home and pantry to get started"
      step={1}
      totalSteps={5}
      onSkip={handleSkip}>
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
        title={isCreating ? 'Creating Home...' : 'Next'}
        onPress={onNext}
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
        disabled={isCreating}
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
