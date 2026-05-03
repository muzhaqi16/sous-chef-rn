import React, { useState, useEffect, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { formatRole } from '#utils/formatters/roleFormatters';
import { type InviteCard_InviteFragment } from './CreateHomeScreen.generated';
import {
  InviteActionsProvider,
  useInviteActions,
} from './InviteActionsContext';

// Components
import { FormContent, type FormValues } from './FormContent';
import { LoadingView } from './LoadingView';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { SubmitButton } from './SubmitButton';
import { ErrorMessage } from './ErrorMessage';
import { Button } from '#components/base/Button';

// GraphQL
import { useMutation, useQuery } from '@apollo/client/react';
import { HomeType } from '#/graphql/generated/schemaTypes';
import {
  CreateHomeDocument,
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';

// Store & Navigation
import { useAppStore, useUser, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';

// Validation & Helpers
import { getCreateHomeSchema } from '#/utils/validation/onboarding';
import { createPantryForHome, showPantryCreationError } from './helpers';
import { normalizeHomes, extractNodes } from '#/utils/connectionUtils';
import { OnboardingErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

/** Module-level cache update closure for `useAcceptHomeInviteMutation`.
 *  Extracted from the component body to keep the surrounding try/catch outside
 *  hook call sites (React Compiler bailout). */
function buildAcceptHomeInviteUpdater(userId: string | undefined) {
  return function acceptHomeInviteUpdater(cache: any, { data }: any) {
    if (!data?.acceptHomeInvite?.membership?.homeId || !userId) return;
    try {
      const homeId = data.acceptHomeInvite.membership.homeId;
      const userCacheId = cache.identify({
        __typename: 'User',
        id: userId,
      });
      if (!userCacheId) return;

      cache.modify({
        id: userCacheId,
        fields: {
          homes(existingHomes: any[] = [], { readField, toReference }: any) {
            const homeRef = toReference({
              __typename: 'Home',
              id: homeId,
            });
            const exists = existingHomes.some(
              (ref: any) => readField('id', ref) === homeId,
            );
            if (exists) return existingHomes;
            return [...existingHomes, homeRef];
          },
        },
      });
    } catch (error) {
      console.warn('Cache update failed for acceptHomeInvite:', error);
      // UI will still work via optimistic/onCompleted handlers
    }
  };
}

/** Module-level async function for home/pantry creation.
 *  Extracted from component body to avoid ThrowStatement-in-try-catch bailout. */
async function performCreateHome(
  data: FormValues,
  deps: {
    needsHome: boolean;
    needsPantry: boolean;
    selectedHomeId: string | null;
    createHome: (opts: { variables: any }) => Promise<any>;
    createPantry: any;
    refetchHomes: () => Promise<any>;
    setSelectedHomeId: (id: string) => void;
    setSelectedPantryId: (id: string) => void;
    skipToStep: (step: string) => void;
    navigateToNextStep: (step: string) => void;
  },
): Promise<void> {
  if (deps.needsHome) {
    const response = await deps.createHome({
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
        deps.setSelectedHomeId(payload.home.id);

        const pantries = extractNodes(payload.home.pantriesConnection) as any[];
        const defaultPantry =
          pantries.find((p: { isDefault: boolean }) => p.isDefault) ||
          pantries[0];
        if (defaultPantry) {
          deps.setSelectedPantryId(defaultPantry.id);
        }
      } else {
        const refetchResult = await deps.refetchHomes();
        const refetchedHomes = normalizeHomes(
          extractNodes(refetchResult.data?.homes),
        );
        const newHome = refetchedHomes.find(
          (h: any) => h.name === data.homeName.trim(),
        );
        if (newHome?.id) {
          deps.setSelectedHomeId(newHome.id);
        } else {
          throw new Error(
            'Home was created but could not be found. Please try again.',
          );
        }
      }
    } else {
      throw new Error(payload?.message || 'Failed to create home');
    }
  } else if (deps.needsPantry && deps.selectedHomeId) {
    const success = await createPantryForHome(
      deps.selectedHomeId,
      data.pantryName,
      deps.createPantry,
      deps.setSelectedPantryId,
    );

    if (!success) {
      showPantryCreationError(() => deps.skipToStep('CreateShoppingList'));
      return;
    }
  }

  deps.navigateToNextStep('CreateHome');
}

/** Module-level helper to sync existing home/pantry state */
function syncExistingResources(
  existingHome: { id: string } | undefined,
  existingPantry: { id: string } | undefined,
  setSelectedHomeId: (id: string) => void,
  setSelectedPantryId: (id: string) => void,
  setCheckingExisting: (v: boolean) => void,
) {
  if (existingHome) {
    setSelectedHomeId(existingHome.id);
    if (existingPantry) {
      setSelectedPantryId(existingPantry.id);
    }
  }
  setCheckingExisting(false);
}

// --- Invite card component ---

const InviteCard: React.FC<{ invite: InviteCard_InviteFragment }> = ({
  invite,
}) => {
  const { theme } = useUnistyles();
  const { handleAcceptInvite, handleDeclineInvite, accepting } =
    useInviteActions();

  const inviterName =
    invite.inviter?.profile?.displayName || invite.inviter?.email || 'Someone';
  const inviteHomeName = invite.home?.name || 'Unknown Home';

  return (
    <View style={styles.inviteCard}>
      <Text
        size="xl"
        weight="bold"
        lineHeight="relaxed"
        style={styles.inviteHomeName}
      >
        {inviteHomeName}
      </Text>

      <View style={styles.inviteDetailsContainer}>
        <Text size="sm" lineHeight="tight">
          <Text weight="medium" tone="secondary">
            From:{' '}
          </Text>
          <Text weight="semibold">{inviterName}</Text>
        </Text>

        <Text size="sm" lineHeight="tight">
          <Text weight="medium" tone="secondary">
            Role:{' '}
          </Text>
          <Text weight="bold" tone="accent">
            {formatRole(invite.role)}
          </Text>
        </Text>
      </View>

      <View style={styles.inviteActions}>
        <Pressable
          style={({ pressed }) => [
            styles.inviteDeclineButton,
            pressed && { opacity: theme.opacity.pressed },
          ]}
          onPress={() => handleDeclineInvite(invite.token, inviteHomeName)}
          disabled={accepting}
        >
          <Text size="sm" weight="semibold">
            Decline
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.inviteAcceptButton,
            pressed && { opacity: theme.opacity.pressed },
          ]}
          onPress={() => handleAcceptInvite(invite.token)}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text
              size="sm"
              weight="semibold"
              style={styles.inviteAcceptButtonText}
            >
              Accept
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const CreateHomeScreenComponent = () => {
  useScreenTransition('CreateHomeScreen');
  const { navigateToNextStep, setUserNavigationState, skipToStep } =
    useOnboardingNavigation();

  const user = useUser();
  const selectedHomeId = useSelectedHomeId();
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
  const {
    data: homesData,
    loading: homesLoading,
    refetch: refetchHomes,
  } = useQuery(GetHomesDocument, {
    skip: !user?.id,
  });

  const { data: pendingInvitesData, loading: invitesLoading } = useQuery(
    GetMyPendingInvitesDocument,
    {
      skip: !user?.id,
    },
  );

  // Extract nodes from connection types (homes and pantries return Connection types)
  const homes = normalizeHomes(extractNodes(homesData?.homes));
  const pendingInvites = pendingInvitesData?.me?.pendingHomeInvites || [];
  const existingHome = homes[0];
  const existingPantry =
    existingHome?.pantries?.find((p: { isDefault: boolean }) => p.isDefault) ||
    existingHome?.pantries?.[0];
  const needsHome = !existingHome;
  const needsPantry = !existingPantry;
  const hasPendingInvites = pendingInvites.length > 0;

  // GraphQL Mutations
  const [createHome] = useMutation(CreateHomeDocument);
  const [createPantry] = useMutation(CreatePantryDocument, {
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
              __typename: 'PantryEdge',
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

  const [acceptHomeInvite, { loading: accepting }] = useMutation(
    AcceptHomeInviteDocument,
    {
      // Manual cache update instead of refetchQueries for better performance.
      // Builder is module-scope so the inner try/catch is not inside the
      // component body (React Compiler bailout).
      update: buildAcceptHomeInviteUpdater(user?.id),
      onCompleted: data => {
        if (data.acceptHomeInvite?.membership?.homeId) {
          setSelectedHomeId(data.acceptHomeInvite.membership.homeId);
          navigateToNextStep('CreateHome');
        }
      },
      onError: error => {
        alertService.alert(
          'Error',
          error.message || 'Failed to accept invitation',
        );
      },
    },
  );

  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument, {
    // Note: Declining an invite doesn't add or remove homes from the list,
    // it just changes the invite status. No cache update needed.
    onError: error => {
      alertService.alert(
        'Error',
        error.message || 'Failed to decline invitation',
      );
    },
  });

  // Form Setup
  const form = useForm<FormValues>({
    resolver: yupResolver(
      getCreateHomeSchema(needsHome),
    ) as Resolver<FormValues>,
    defaultValues: {
      homeName: '',
      pantryName: 'Kitchen Pantry',
    },
  });

  // Check existing resources without auto-navigating
  useEffect(() => {
    if (homesLoading) return;

    syncExistingResources(
      existingHome,
      existingPantry,
      setSelectedHomeId,
      setSelectedPantryId,
      setCheckingExisting,
    );
  }, [
    homesLoading,
    existingHome,
    existingPantry,
    setSelectedHomeId,
    setSelectedPantryId,
  ]);

  // Form submission handler
  const onSubmit = (data: FormValues) => {
    setGraphqlError(null);

    executeWithLoadingState(
      () =>
        performCreateHome(data, {
          needsHome,
          needsPantry,
          selectedHomeId,
          createHome,
          createPantry,
          refetchHomes,
          setSelectedHomeId,
          setSelectedPantryId,
          skipToStep,
          navigateToNextStep,
        }),
      setIsCreating,
      (error: unknown) => {
        setGraphqlError(
          (error as any)?.message || 'An error occurred during setup',
        );
      },
    );
  };

  const handleAcceptInvite = (token: string) => {
    // Error handled by onError in mutation config
    executeMutation(
      () => acceptHomeInvite({ variables: { token } }),
      'Failed to accept home invite',
    );
  };

  const handleDeclineInvite = (token: string, homeNameParam: string) => {
    alertService.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${homeNameParam}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            // Error handled by onError in mutation config
            executeMutation(
              () => declineHomeInvite({ variables: { token } }),
              'Failed to decline home invite',
            );
          },
        },
      ],
    );
  };

  // Loading state
  if (checkingExisting || homesLoading || invitesLoading) {
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
          <Text size="md" weight="semibold" style={styles.invitesSectionTitle}>
            Pending Invitations
          </Text>
          <InviteActionsProvider
            handleAcceptInvite={handleAcceptInvite}
            handleDeclineInvite={handleDeclineInvite}
            accepting={accepting}
          >
            {pendingInvites.map(invite => (
              <InviteCard key={invite.id} invite={invite} />
            ))}
          </InviteActionsProvider>
        </View>

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text
            size="sm"
            tone="secondary"
            weight="medium"
            style={styles.dividerText}
          >
            OR
          </Text>
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
            <Text size="xs" tone="secondary" style={styles.resourceLabel}>
              Home
            </Text>
            <Text size="lg" weight="semibold">
              {existingHome.name}
            </Text>

            <View style={styles.pantrySection}>
              <Text size="xs" tone="secondary" style={styles.resourceLabel}>
                Pantry
              </Text>
              <Text size="lg" weight="semibold">
                {existingPantry.name}
              </Text>
              {!!existingPantry.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text
                    size="xs"
                    weight="semibold"
                    tone="accent"
                    style={styles.defaultBadgeText}
                  >
                    Default
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text
            size="sm"
            tone="secondary"
            align="center"
            lineHeight="normal"
            style={styles.infoText}
          >
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
      {!!existingHome && (
        <View style={styles.existingResourcesContainer}>
          <View style={styles.resourceCard}>
            <Text size="xs" tone="secondary" style={styles.resourceLabel}>
              Existing Home
            </Text>
            <Text size="lg" weight="semibold">
              {existingHome.name}
            </Text>
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

      {graphqlError ? <ErrorMessage message={graphqlError} /> : null}
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
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pantrySection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
    textTransform: 'uppercase',
  },
  infoText: {
    marginTop: theme.spacing.md,
  },
  invitesContainer: {
    marginVertical: theme.spacing.lg,
  },
  invitesSectionTitle: {
    marginBottom: theme.spacing.md,
  },
  inviteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 4,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    ],
  },
  inviteHomeName: {
    marginBottom: theme.spacing.md,
  },
  inviteDetailsContainer: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  inviteDeclineButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteAcceptButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  inviteAcceptButtonText: {
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
  },
}));
