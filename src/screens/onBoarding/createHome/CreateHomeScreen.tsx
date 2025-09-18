import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ApolloCache } from '@apollo/client';

// Components
import { FormContent, type FormValues } from './FormContent';
import { LoadingView } from './LoadingView';
import { OnBoardingWrapper } from '#components/templates';
import { SubmitButton } from './SubmitButton';
import { ErrorMessage } from './ErrorMessage';
import { Button } from '#components';

// GraphQL
import {
  HomeType,
  useCreateHomeMutation,
  useCreatePantryMutation,
  useGetHomesQuery,
  useGetPantriesQuery,
  GetHomesDocument,
  GetHomesQuery,
} from '#generated';

// Store & Navigation
import { useStore } from '#store';
import { useOnboardingNavigation } from '#hooks';

// Validation & Helpers
import { getCreateHomeSchema } from '#/utils';
import { createPantryForHome, showPantryCreationError } from './helpers';

export const CreateHomeScreen = () => {
  const { navigateToNextStep, setUserNavigationState, skipToStep } =
    useOnboardingNavigation();

  const { user, selectedHomeId, setSelectedHomeId, setSelectedPantryId } =
    useStore();

  // State
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Track onboarding start (only once at the beginning)
  const hasTrackedStartRef = useRef(false);
  useEffect(() => {
    if (user?.id && !hasTrackedStartRef.current) {
      setUserNavigationState(user.id, {
        onboardingStartedAt: Date.now(),
        isNewUser: true,
      });
      hasTrackedStartRef.current = true;
    }
  }, [user?.id, setUserNavigationState]);

  // GraphQL Queries
  const { data: homesData, loading: homesLoading } = useGetHomesQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const { data: pantriesData, loading: pantriesLoading } = useGetPantriesQuery({
    variables: { homeId: selectedHomeId || '' },
    skip: !selectedHomeId,
    fetchPolicy: 'cache-and-network',
  });

  const homes = homesData?.homes || [];
  const pantries = pantriesData?.pantries || [];
  const existingHome = homes[0];
  const existingPantry = pantries.find(p => p.isDefault) || pantries[0];
  const needsHome = !existingHome;
  const needsPantry = !existingPantry;

  // GraphQL Mutations
  const [createHome] = useCreateHomeMutation();
  const [createPantry] = useCreatePantryMutation({
    update: (cache: ApolloCache, { data }: any) => {
      if (data?.createPantry) {
        try {
          const existingHomesData = cache.readQuery<GetHomesQuery>({
            query: GetHomesDocument,
          });

          if (existingHomesData?.homes) {
            const updatedHomes = existingHomesData.homes.map((home: any) => {
              if (home.id === data.createPantry.homeId) {
                return {
                  ...home,
                  pantries: [
                    ...(home.pantries || []),
                    {
                      id: data.createPantry.id,
                      name: data.createPantry.name,
                      isDefault: data.createPantry.isDefault,
                    },
                  ],
                };
              }
              return home;
            });

            cache.writeQuery<GetHomesQuery>({
              query: GetHomesDocument,
              data: { homes: updatedHomes },
            });
          }
        } catch (error) {
          console.log('Cache update failed, will rely on refetch:', error);
        }
      }
    },
  });

  // Form Setup
  const form = useForm<FormValues>({
    resolver: yupResolver(getCreateHomeSchema(needsHome)) as any,
    defaultValues: {
      homeName: '',
      pantryName: 'Kitchen Pantry',
    },
  });

  // Check existing resources without auto-navigating
  useEffect(() => {
    let isMounted = true;

    const checkExisting = async () => {
      if (homesLoading || (selectedHomeId && pantriesLoading)) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isMounted) return;

        // Set selected IDs if they exist, but don't auto-navigate
        if (existingHome) {
          setSelectedHomeId(existingHome.id);
          if (existingPantry) {
            setSelectedPantryId(existingPantry.id);
          }
        }

        setCheckingExisting(false);
      } catch (error) {
        if (isMounted) {
          setCheckingExisting(false);
        }
      }
    };

    checkExisting();

    return () => {
      isMounted = false;
    };
  }, [
    homesLoading,
    pantriesLoading,
    selectedHomeId,
    existingHome,
    existingPantry,
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

        // Create pantry if needed
        if (needsPantry && homeId) {
          const success = await createPantryForHome(
            homeId,
            data.pantryName,
            createPantry,
            setSelectedPantryId,
          );

          if (!success) {
            showPantryCreationError(() => skipToStep('CreateShoppingList'));
            return;
          }
        }

        navigateToNextStep('CreateHome');
      } catch (error: any) {
        setGraphqlError(error.message || 'An error occurred during setup');
      } finally {
        setIsCreating(false);
      }
    },
    [
      needsHome,
      needsPantry,
      selectedHomeId,
      createHome,
      createPantry,
      setSelectedHomeId,
      setSelectedPantryId,
      navigateToNextStep,
      skipToStep,
    ],
  );

  // Loading state
  if (checkingExisting || homesLoading || (selectedHomeId && pantriesLoading)) {
    return <LoadingView onSkip={() => skipToStep('CreateShoppingList')} />;
  }

  // Determine what needs to be created
  const getTitle = () => {
    if (!existingHome) return "Welcome! Let's set up your home";
    if (!existingPantry) return 'Almost there!';
    return "You're all set!";
  };

  const getSubtitle = () => {
    if (!existingHome) return 'Create your home and pantry to get started';
    if (!existingPantry) return `Let's add a pantry to ${existingHome.name}`;
    return 'Your home and pantry are already configured';
  };

  // If both exist, show summary and continue button
  if (existingHome && existingPantry) {
    return (
      <OnBoardingWrapper
        title={getTitle()}
        subtitle={getSubtitle()}
        step={1}
        totalSteps={6}
        onSkip={() => skipToStep('CreateShoppingList')}
      >
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text style={styles.resourceLabel}>Home</Text>
            <Text style={styles.resourceName}>{existingHome.name}</Text>
          </View>

          <View style={styles.resourceCard}>
            <Text style={styles.resourceLabel}>Pantry</Text>
            <Text style={styles.resourceName}>{existingPantry.name}</Text>
            {existingPantry.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>

          <Text style={styles.infoText}>
            These were already set up. You can continue to the next step or
            create additional ones later in settings.
          </Text>
        </View>

        <Button
          title="Continue"
          onPress={() => navigateToNextStep('CreateHome')}
          btnStyle={styles.continueButton}
          txtStyle={styles.continueText}
        />
      </OnBoardingWrapper>
    );
  }

  // Show form for creating what's missing
  return (
    <OnBoardingWrapper
      title={getTitle()}
      subtitle={getSubtitle()}
      step={1}
      totalSteps={6}
      onSkip={() => skipToStep('CreateShoppingList')}
    >
      {existingHome && (
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text style={styles.resourceLabel}>Existing Home</Text>
            <Text style={styles.resourceName}>{existingHome.name}</Text>
          </View>
        </View>
      )}

      <FormContent
        form={form}
        needsHome={needsHome}
        existingHomeName={existingHome?.name}
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

const styles = StyleSheet.create(theme => ({
  existingResourcesContainer: {
    marginVertical: 20,
  },
  resourceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  resourceLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  continueText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
