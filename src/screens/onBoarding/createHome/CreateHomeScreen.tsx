import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { formatRole } from '#utils/formatters';

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
  useGetMyPendingInvitesQuery,
  useAcceptHomeInviteMutation,
  useDeclineHomeInviteMutation,
} from '#generated';

// Store & Navigation
import { useStore } from '#store';
import { useOnboardingNavigation } from '#hooks';

// Validation & Helpers
import { getCreateHomeSchema } from '#/utils';
import { createPantryForHome, showPantryCreationError } from './helpers';
import { normalizeHomes } from '#/utils/connectionUtils';

export const CreateHomeScreen = () => {
  const { theme } = useUnistyles();
  const { navigateToNextStep, setUserNavigationState, skipToStep } =
    useOnboardingNavigation();

  const { user, selectedHomeId, setSelectedHomeId, setSelectedPantryId } =
    useStore();

  // State
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [forceShowCreateForm, setForceShowCreateForm] = useState(false);

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

  const { data: pendingInvitesData, loading: invitesLoading } =
    useGetMyPendingInvitesQuery({
      skip: !user?.id,
      fetchPolicy: 'cache-and-network',
    });

  const homes = normalizeHomes(homesData?.homes);
  const pantries = pantriesData?.pantries || [];
  const pendingInvites = pendingInvitesData?.myPendingInvites || [];
  const existingHome = homes[0];
  const existingPantry = pantries.find(p => p.isDefault) || pantries[0];
  const needsHome = !existingHome;
  const needsPantry = !existingPantry;
  const hasPendingInvites = pendingInvites.length > 0;

  // GraphQL Mutations
  const [createHome] = useCreateHomeMutation();
  const [createPantry] = useCreatePantryMutation({
    update: (cache, { data }) => {
      const newPantry = data?.createPantry;
      if (!newPantry?.homeId) {
        return;
      }

      const homeCacheId = cache.identify({
        __typename: 'Home',
        id: newPantry.homeId,
      });

      if (!homeCacheId) {
        return;
      }

      cache.modify({
        id: homeCacheId,
        fields: {
          pantries(existingPantries = []) {
            return [
              ...existingPantries,
              {
                __typename: 'Pantry',
                id: newPantry.id,
                name: newPantry.name,
                isDefault: newPantry.isDefault,
              },
            ];
          },
          pantriesConnection(existingConnection = null) {
            if (!existingConnection) {
              return existingConnection;
            }

            const newEdge = {
              __typename: 'PantryEdge',
              cursor: newPantry.id,
              node: {
                __typename: 'Pantry',
                ...newPantry,
              },
            };

            const edges = [...(existingConnection.edges || []), newEdge];

            return {
              ...existingConnection,
              edges,
              totalCount:
                (existingConnection.totalCount ?? edges.length) +
                (existingConnection.edges?.length === edges.length ? 0 : 0),
            };
          },
        },
      });
    },
  });

  const [acceptHomeInvite, { loading: accepting }] =
    useAcceptHomeInviteMutation({
      // Note: This mutation returns a Membership object with homeId.
      // The Home should be refetched via GetHomesQuery to get the full home data.
      refetchQueries: ['GetHomes'],
      onCompleted: data => {
        if (data.acceptHomeInvite?.homeId) {
          setSelectedHomeId(data.acceptHomeInvite.homeId);
          navigateToNextStep('CreateHome');
        }
      },
      onError: error => {
        Alert.alert('Error', error.message || 'Failed to accept invitation');
      },
    });

  const [declineHomeInvite] = useDeclineHomeInviteMutation({
    // Note: Declining an invite doesn't add or remove homes from the list,
    // it just changes the invite status. No cache update needed.
    onError: error => {
      Alert.alert('Error', error.message || 'Failed to decline invitation');
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

  const handleAcceptInvite = async (token: string) => {
    try {
      await acceptHomeInvite({ variables: { token } });
    } catch (error) {
      // Error handled by onError in mutation
    }
  };

  const handleDeclineInvite = (token: string, homeNameParam: string) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${homeNameParam}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineHomeInvite({ variables: { token } });
            } catch (error) {
              // Error handled by onError in mutation
            }
          },
        },
      ],
    );
  };

  // Loading state
  if (checkingExisting || homesLoading || invitesLoading || (selectedHomeId && pantriesLoading)) {
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

  // If user has pending invites and no home, show invitations (unless forcing create form)
  if (hasPendingInvites && !existingHome && !forceShowCreateForm) {
    return (
      <OnBoardingWrapper
        title="You have pending home invitations!"
        subtitle="Accept an invitation to join an existing home or create your own"
        step={1}
        totalSteps={7}
        onSkip={() => skipToStep('CreateShoppingList')}
      >
        <View style={styles.invitesContainer}>
          <Text style={styles.invitesSectionTitle}>Pending Invitations</Text>
          {pendingInvites.map(invite => {
            const inviterName = invite.inviter?.profile?.displayName || invite.inviter?.email || 'Someone';
            const inviteHomeName = invite.home?.name || 'Unknown Home';

            return (
              <View key={invite.id} style={styles.inviteCard}>
                {/* Home name - prominent */}
                <Text style={styles.inviteHomeName}>{inviteHomeName}</Text>

                {/* Invitation details */}
                <View style={styles.inviteDetailsContainer}>
                  <Text style={styles.inviteDetail}>
                    <Text style={styles.inviteDetailLabel}>From: </Text>
                    <Text style={styles.inviteDetailValue}>{inviterName}</Text>
                  </Text>

                  <Text style={styles.inviteDetail}>
                    <Text style={styles.inviteDetailLabel}>Role: </Text>
                    <Text style={styles.inviteRoleText}>{formatRole(invite.role)}</Text>
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.inviteDeclineButton]}
                    onPress={() => handleDeclineInvite(invite.token, inviteHomeName)}
                    disabled={accepting}>
                    <Text style={styles.inviteDeclineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.inviteAcceptButton]}
                    onPress={() => handleAcceptInvite(invite.token)}
                    disabled={accepting}>
                    {accepting ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <Text style={styles.inviteAcceptButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Create My Own Home"
          onPress={() => setForceShowCreateForm(true)}
          btnStyle={styles.createOwnButton}
          txtStyle={styles.createOwnText}
        />

        <Button
          title="Skip for Now"
          onPress={() => skipToStep('CreateShoppingList')}
          btnStyle={styles.skipButton}
          txtStyle={styles.skipText}
        />
      </OnBoardingWrapper>
    );
  }

  // If both exist, show summary and continue button
  if (existingHome && existingPantry) {
    return (
      <OnBoardingWrapper
        title={getTitle()}
        subtitle={getSubtitle()}
        step={1}
        totalSteps={7}
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
      totalSteps={7}
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
    marginVertical: theme.spacing.lg,
  },
  resourceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  resourceLabel: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  continueText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.bold,
  },
  invitesContainer: {
    marginVertical: theme.spacing.lg,
  },
  invitesSectionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  inviteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteHomeName: {
    fontSize: 20,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    lineHeight: 26,
  },
  inviteDetailsContainer: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  inviteDetail: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  inviteDetailLabel: {
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  inviteDetailValue: {
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  inviteRoleText: {
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.primary,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteDeclineButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteDeclineButtonText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  inviteAcceptButton: {
    backgroundColor: theme.colors.primary,
  },
  inviteAcceptButtonText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fonts.weight.medium,
  },
  createOwnButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  createOwnText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  skipButton: {
    backgroundColor: theme.colors.transparent,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
  },
}));
