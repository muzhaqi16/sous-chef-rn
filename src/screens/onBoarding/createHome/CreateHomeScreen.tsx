// screens/onboarding/CreateHomeScreen.tsx
import React, {useState, useEffect, useCallback} from 'react';
import {Text, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {StyleSheet} from 'react-native-unistyles';
import * as yup from 'yup';

// Components
import {OnBoardingWrapper} from '#components/templates';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';
import {BaseInput, Button} from '#components';

// GraphQL
import {
  HomeType,
  useCreateHomeMutation,
  useCreatePantryMutation,
  useGetHomesQuery,
  useGetPantriesQuery,
} from '#generated';

// Store & Navigation
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import {useNavigationState} from '#hooks';
import NavigationService from '#/services/NavigationService';

// Validation & Helpers
import {getCreateHomeSchema} from '#/utils';
import {
  navigateToNextStep,
  checkExistingResources,
  createPantryForHome,
  showPantryCreationError,
  showSkipPantryWarning,
} from './helpers';

type FormValues = {
  homeName: string;
  pantryName: string;
};

export const CreateHomeScreen = () => {
  const {saveUserProgress} = useNavigationState();

  const {
    setSelectedHomeId,
    setSelectedPantryId,
    setOnBoardingStep,
    setUserNavigationState,
    user,
    selectedHomeId,
  } = useStore();

  // State
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // GraphQL Queries
  const {data: homesData, loading: homesLoading} = useGetHomesQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const {data: pantriesData, loading: pantriesLoading} = useGetPantriesQuery({
    variables: {homeId: selectedHomeId || ''},
    skip: !selectedHomeId,
    fetchPolicy: 'cache-and-network',
  });

  const homes = homesData?.homes || [];
  const pantries = pantriesData?.pantries || [];
  const needsHome = homes.length === 0;

  // GraphQL Mutations
  const [createHome] = useCreateHomeMutation();
  const [createPantry] = useCreatePantryMutation();

  // Form Setup
  const form = useForm<FormValues>({
    resolver: yupResolver(getCreateHomeSchema(needsHome)) as any,
    defaultValues: {
      homeName: '',
      pantryName: 'Kitchen Pantry',
    },
  });

  // Navigation helper
  const goToNextStep = useCallback(() => {
    navigateToNextStep(
      user,
      setUserNavigationState,
      setOnBoardingStep,
      saveUserProgress,
    );
  }, [user, setUserNavigationState, setOnBoardingStep, saveUserProgress]);

  // Check existing resources on mount
  useEffect(() => {
    if (!homesLoading && !pantriesLoading) {
      checkExistingResources(homes, pantries, {
        onComplete: () => setCheckingExisting(false),
        onBothExist: goToNextStep,
        setSelectedHomeId,
        setSelectedPantryId,
      });
    }
  }, [
    homes,
    pantries,
    homesLoading,
    pantriesLoading,
    goToNextStep,
    setSelectedHomeId,
    setSelectedPantryId,
  ]);

  // Form submission handler
  const onSubmit = useCallback(
    async (data: FormValues) => {
      setIsCreating(true);
      setGraphqlError(null);

      try {
        let homeId = selectedHomeId;

        // Create home if needed
        if (needsHome) {
          const response = await createHome({
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

          if (response.data?.createHome) {
            homeId = response.data.createHome.id;
            setSelectedHomeId(homeId);
          } else {
            throw new Error('Failed to create home');
          }
        }

        // Create pantry
        if (homeId) {
          const success = await createPantryForHome(
            homeId,
            data.pantryName,
            createPantry,
            setSelectedPantryId,
          );

          if (!success) {
            showPantryCreationError(goToNextStep);
            return;
          }
        }

        goToNextStep();
      } catch (error: any) {
        setGraphqlError(error.message || 'An error occurred during setup');
      } finally {
        setIsCreating(false);
      }
    },
    [
      needsHome,
      selectedHomeId,
      createHome,
      createPantry,
      setSelectedHomeId,
      setSelectedPantryId,
      goToNextStep,
    ],
  );

  // Skip handler
  const handleSkip = useCallback(() => {
    if (homes.length > 0 && pantries.length === 0) {
      showSkipPantryWarning(goToNextStep);
    } else {
      goToNextStep();
    }
  }, [homes.length, pantries.length, goToNextStep]);

  // Loading state
  if (checkingExisting || homesLoading || (selectedHomeId && pantriesLoading)) {
    return <LoadingView onSkip={handleSkip} />;
  }

  const existingHomeName = homes[0]?.name;

  return (
    <OnBoardingWrapper
      title={needsHome ? "Welcome! Let's set up your home" : 'Almost there!'}
      subtitle={
        needsHome
          ? 'Create your home and pantry to get started'
          : `Let's add a pantry to ${existingHomeName}`
      }
      step={1}
      totalSteps={5}
      onSkip={handleSkip}>
      <FormContent
        form={form}
        needsHome={needsHome}
        existingHomeName={existingHomeName}
      />

      <SubmitButton
        isCreating={isCreating}
        needsHome={needsHome}
        onPress={form.handleSubmit(onSubmit)}
      />

      {graphqlError && <ErrorMessage message={graphqlError} />}
    </OnBoardingWrapper>
  );
};

// Sub-components for better organization
const LoadingView = ({onSkip}: {onSkip: () => void}) => (
  <OnBoardingWrapper
    title="Welcome! Let's set up your home"
    subtitle="Checking your existing setup..."
    step={1}
    totalSteps={5}
    onSkip={onSkip}>
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={styles.loadingIndicator.color} />
      <Text style={styles.loadingText}>Checking your existing setup...</Text>
    </View>
  </OnBoardingWrapper>
);

const FormContent = ({
  form,
  needsHome,
  existingHomeName,
}: {
  form: any;
  needsHome: boolean;
  existingHomeName?: string;
}) => (
  <>
    <DynamicFormFields<FormValues>
      fields={[
        ...(needsHome
          ? [
              {
                name: 'homeName' as const,
                label: 'Home Name',
                placeholder: 'e.g. Smith Family Home',
                component: BaseInput,
              },
            ]
          : []),
        {
          name: 'pantryName' as const,
          label: needsHome ? 'Default Pantry Name' : 'Pantry Name',
          placeholder: 'e.g. Kitchen Pantry',
          component: BaseInput,
        },
      ]}
      control={form.control}
      errors={form.formState.errors}
    />

    {!needsHome && existingHomeName && (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Using existing home: {existingHomeName}
        </Text>
      </View>
    )}
  </>
);

const SubmitButton = ({
  isCreating,
  needsHome,
  onPress,
}: {
  isCreating: boolean;
  needsHome: boolean;
  onPress: () => void;
}) => (
  <Button
    title={
      isCreating
        ? needsHome
          ? 'Creating Home & Pantry...'
          : 'Creating Pantry...'
        : 'Next'
    }
    onPress={onPress}
    btnStyle={styles.nextButton}
    txtStyle={styles.nextText}
    disabled={isCreating}
  />
);

const ErrorMessage = ({message}: {message: string}) => (
  <Text style={styles.errorText}>{message}</Text>
);

// Styles
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
  infoBox: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
  },
}));
