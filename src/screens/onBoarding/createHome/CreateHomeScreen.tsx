import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { formatRole } from '#utils/formatters/roleFormatters';

// Components
import { FormContent, type FormValues } from './FormContent';
import { LoadingView } from './LoadingView';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { SubmitButton } from './SubmitButton';
import { ErrorMessage } from './ErrorMessage';
import { Button } from '#components/base/Button';

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
import {
  useAppStore,
  selectUser,
  selectSelectedHomeId,
} from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';

// Validation & Helpers
import { getCreateHomeSchema } from '#/utils/validation/onboarding';
import { createPantryForHome, showPantryCreationError } from './helpers';
import { normalizeHomes, extractNodes } from '#/utils/connectionUtils';
import { OnboardingErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

const CreateHomeScreenComponent = () => {
  useScreenTransition('CreateHomeScreen');
  const { theme } = useUnistyles();
  const { navigateToNextStep, setUserNavigationState, skipToStep } =
    useOnboardingNavigation();

  const user = useAppStore(selectUser);
  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const setSelectedHomeId = useAppStore(state => state.setSelectedHomeId);
  const setSelectedPantryId = useAppStore(state => state.setSelectedPantryId);

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
  const { data: homesData, loading: homesLoading, refetch: refetchHomes } = useGetHomesQuery({
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

  // Extract nodes from connection types (homes and pantries return Connection types)
  const homes = normalizeHomes(extractNodes(homesData?.homes));
  const pantries = extractNodes(pantriesData?.pantries);
  const pendingInvites = pendingInvitesData?.me?.pendingHomeInvites || [];
  const existingHome = homes[0];
  const existingPantry = pantries.find(p => p.isDefault) || pantries[0];
  const needsHome = !existingHome;
  const needsPantry = !existingPantry;
  const hasPendingInvites = pendingInvites.length > 0;

  // GraphQL Mutations
  const [createHome] = useCreateHomeMutation();
  const [createPantry] = useCreatePantryMutation({
    update: (cache, { data }) => {
      const newPantry = data?.createPantry?.pantry;
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
              __typename: 'PantryEdge' as const,
              cursor: newPantry.id,
              node: newPantry,
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
      // Manual cache update instead of refetchQueries for better performance
      // The mutation returns a Membership object with homeId; the Home entity
      // should already exist in cache from the invite query
      update: (cache, { data }) => {
        if (!data?.acceptHomeInvite?.membership?.homeId || !user?.id) return;

        try {
          const homeId = data.acceptHomeInvite.membership.homeId;

          // The Home entity should already be cached from the invite query
          // We just need to ensure it's in the GetHomes query result
          const userCacheId = cache.identify({
            __typename: 'User',
            id: user.id,
          });

          if (!userCacheId) return;

          // Update the user's homes field to include the new home
          cache.modify({
            id: userCacheId,
            fields: {
              homes(existingHomes = [], { readField, toReference }) {
                const homeRef = toReference({
                  __typename: 'Home',
                  id: homeId,
                });

                // Check if home already exists in the list
                const exists = existingHomes.some(
                  (ref: any) => readField('id', ref) === homeId,
                );

                if (exists) {
                  return existingHomes;
                }

                return [...existingHomes, homeRef];
              },
            },
          });
        } catch (error) {
          console.warn('Cache update failed for acceptHomeInvite:', error);
          // UI will still work via optimistic/onCompleted handlers
        }
      },
      onCompleted: data => {
        if (data.acceptHomeInvite?.membership?.homeId) {
          setSelectedHomeId(data.acceptHomeInvite.membership.homeId);
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
      } catch {
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

        if (needsHome) {
          // Single mutation: create home + default pantry together
          const response = await createHome({
            variables: {
              input: {
                name: data.homeName.trim(),
                description: 'Created during onboarding',
                type: HomeType.Household,
                isPublic: false,
                allowJoinCode: true,
                createDefaultPantry: true,
                defaultPantryName: data.pantryName.trim(),
                tags: ['onboarding'],
              },
            },
          });

          const payload = response.data?.createHome;

          if (payload?.success) {
            if (payload.home) {
              homeId = payload.home.id;
              setSelectedHomeId(homeId);
            } else {
              // Success but home object null — refetch to get the ID
              const refetchResult = await refetchHomes();
              const refetchedHomes = normalizeHomes(extractNodes(refetchResult.data?.homes));
              const newHome = refetchedHomes.find((h: any) => h.name === data.homeName.trim());
              if (newHome) {
                homeId = newHome.id;
                setSelectedHomeId(homeId);
              } else {
                throw new Error('Home was created but could not be found. Please try again.');
              }
            }
          } else {
            throw new Error(payload?.message || 'Failed to create home');
          }
        } else if (needsPantry && selectedHomeId) {
          // Only create pantry separately if home already exists but pantry doesn't
          const success = await createPantryForHome(
            selectedHomeId,
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
      refetchHomes,
      setSelectedHomeId,
      setSelectedPantryId,
      navigateToNextStep,
      skipToStep,
    ],
  );

  const handleAcceptInvite = useCallback(async (token: string) => {
    try {
      await acceptHomeInvite({ variables: { token } });
    } catch {
      // Error handled by onError in mutation
    }
  }, [acceptHomeInvite]);

  const handleDeclineInvite = useCallback((token: string, homeNameParam: string) => {
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
            } catch {
              // Error handled by onError in mutation
            }
          },
        },
      ],
    );
  }, [declineHomeInvite]);

  const renderInviteItem = useCallback(
    ({ item: invite }: { item: (typeof pendingInvites)[number] }) => {
      const inviterName =
        invite.inviter?.profile?.displayName ||
        invite.inviter?.email ||
        'Someone';
      const inviteHomeName = invite.home?.name || 'Unknown Home';

      return (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteHomeName}>{inviteHomeName}</Text>

          <View style={styles.inviteDetailsContainer}>
            <Text style={styles.inviteDetail}>
              <Text style={styles.inviteDetailLabel}>From: </Text>
              <Text style={styles.inviteDetailValue}>
                {inviterName}
              </Text>
            </Text>

            <Text style={styles.inviteDetail}>
              <Text style={styles.inviteDetailLabel}>Role: </Text>
              <Text style={styles.inviteRoleText}>
                {formatRole(invite.role)}
              </Text>
            </Text>
          </View>

          <View style={styles.inviteActions}>
            <Pressable
              style={({pressed}) => [styles.button, styles.inviteDeclineButton, pressed && styles.pressed]}
              onPress={() =>
                handleDeclineInvite(invite.id, inviteHomeName)
              }
              disabled={accepting}
            >
              <Text style={styles.inviteDeclineButtonText}>
                Decline
              </Text>
            </Pressable>
            <Pressable
              style={({pressed}) => [styles.button, styles.inviteAcceptButton, pressed && styles.pressed]}
              onPress={() => handleAcceptInvite(invite.id)}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.white}
                />
              ) : (
                <Text style={styles.inviteAcceptButtonText}>
                  Accept
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    },
    [accepting, handleAcceptInvite, handleDeclineInvite, theme.colors.white],
  );

  // Loading state
  if (
    checkingExisting ||
    homesLoading ||
    invitesLoading ||
    (selectedHomeId && pantriesLoading)
  ) {
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
          <FlashList
            data={pendingInvites}
            keyExtractor={invite => invite.id}
            renderItem={renderInviteItem}
          />
        </View>

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Create My Own Home"
          onPress={() => setForceShowCreateForm(true)}
          variant="secondary"
        />

        <Button
          title="Skip for Now"
          onPress={() => skipToStep('CreateShoppingList')}
          variant="ghost"
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
          variant="primary"
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
      testID="onboarding-create-home-screen"
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

// PERFORMANCE: Screen-level error boundary prevents full app reset on mutation failures
export const CreateHomeScreen = () => (
  <OnboardingErrorBoundary>
    <CreateHomeScreenComponent />
  </OnboardingErrorBoundary>
);

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
    lineHeight: theme.typography.lineHeight.normal,
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
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.relaxed,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
