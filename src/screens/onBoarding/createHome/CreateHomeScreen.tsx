import React, { useState, useEffect, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { handleMutationError } from '#/utils/errorHandlers';
import { errorMessageOr } from '#/services/errorService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { formatRole } from '#utils/formatters/roleFormatters';
import { InviteCard_InviteFragmentDoc } from './CreateHomeScreen.generated';
import type { FragmentType } from '@apollo/client/masking';
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
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import { ApolloCache, type Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { HomeType } from '#/graphql/generated/schemaTypes';
import {
  CreateHomeDocument,
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
  type AcceptHomeInviteMutation,
  type CreateHomeMutation,
  type CreateHomeMutationVariables,
} from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';

// Store & Navigation
import {
  useAppStore,
  useSelectedHomeId,
  useSetSelectedPantryId,
  useUser,
} from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';

// Validation & Helpers
import { getCreateHomeSchema } from '#/utils/validation/onboarding';
import { logValidationErrors } from '#/utils/validation/common';
import {
  createPantryForHome,
  showPantryCreationError,
  type CreatePantryFn,
} from './helpers';
import { extractNodes } from '#/utils/connectionUtils';
import { OnboardingErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  executeWithLoadingState,
  executeMutation,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';

/** Module-level cache update closure for `useAcceptHomeInviteMutation`.
 *  Extracted from the component body to keep the surrounding try/catch outside
 *  hook call sites (React Compiler bailout). */
function buildAcceptHomeInviteUpdater(userId: string | undefined) {
  return function acceptHomeInviteUpdater(
    cache: ApolloCache,
    { data }: { data?: AcceptHomeInviteMutation | null },
  ) {
    const acceptPayload = data?.acceptHomeInvite;
    if (
      acceptPayload?.__typename !== 'AcceptHomeInvitePayload' ||
      !acceptPayload.membership?.homeId ||
      !userId
    )
      return;
    try {
      const homeId = acceptPayload.membership.homeId;
      const userCacheId = cache.identify({
        __typename: 'User',
        id: userId,
      });
      if (!userCacheId) return;

      cache.modify({
        id: userCacheId,
        fields: {
          homes(
            existingHomes: readonly Reference[] = [],
            { readField, toReference }: ModifierDetails,
          ) {
            const homeRef = toReference({
              __typename: 'Home',
              id: homeId,
            });
            const exists = existingHomes.some(
              ref => readField('id', ref) === homeId,
            );
            if (exists) return existingHomes;
            return homeRef ? [...existingHomes, homeRef] : existingHomes;
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
type CreateHomeFn = useMutation.MutationFunction<
  CreateHomeMutation,
  CreateHomeMutationVariables
>;

async function performCreateHome(
  data: FormValues,
  deps: {
    needsHome: boolean;
    needsPantry: boolean;
    selectedHomeId: string | null;
    createHome: CreateHomeFn;
    createPantry: CreatePantryFn;
    refetchHomes: () => Promise<unknown>;
    setSelectedHomeId: (id: string) => void;
    setSelectedPantryId: (id: string) => void;
    skipToStep: (step: string) => void;
    navigateToNextStep: (step: string) => void;
    homeNotFoundMessage: string;
    createHomeFailedMessage: string;
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

    const payload = unwrapPayload(
      response.data?.createHome,
      'CreateHomePayload',
      deps.createHomeFailedMessage,
    );

    deps.setSelectedHomeId(payload.home.id);

    const pantries = extractNodes<{ id: string; isDefault: boolean }>(
      payload.home.pantriesConnection,
    );
    const defaultPantry = pantries.find(p => p.isDefault) || pantries[0];
    if (defaultPantry) {
      deps.setSelectedPantryId(defaultPantry.id);
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

const InviteCard: React.FC<{
  inviteRef: FragmentType<typeof InviteCard_InviteFragmentDoc>;
}> = ({ inviteRef }) => {
  const { t } = useTranslation();
  const { handleAcceptInvite, handleDeclineInvite, accepting } =
    useInviteActions();

  // Per-entity cache subscription via fragment colocation: this card
  // re-renders only when this HomeInvite's fields change (e.g., after a
  // revoke/decline mutation).
  const { data: invite, complete } = useFragment({
    fragment: InviteCard_InviteFragmentDoc,
    fragmentName: 'InviteCard_invite',
    from: inviteRef,
  });

  if (!complete) return null;

  const inviterName =
    invite.inviter?.profile?.displayName ||
    invite.inviter?.email ||
    t('labels.someone');
  const inviteHomeName = invite.home?.name || t('labels.unknownHome');

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
            {t('labels.from')}:{' '}
          </Text>
          <Text weight="semibold">{inviterName}</Text>
        </Text>

        <Text size="sm" lineHeight="tight">
          <Text weight="medium" tone="secondary">
            {t('labels.role')}:{' '}
          </Text>
          <Text weight="bold" tone="accent">
            {formatRole(invite.role)}
          </Text>
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <AppPressable
          style={styles.inviteDeclineButton}
          onPress={() => handleDeclineInvite(invite.token, inviteHomeName)}
          disabled={accepting}
        >
          <Text size="sm" weight="semibold">
            {t('labels.decline')}
          </Text>
        </AppPressable>
        <AppPressable
          style={styles.inviteAcceptButton}
          onPress={() => handleAcceptInvite(invite.token)}
          disabled={accepting}
        >
          {accepting ? (
            <WhiteActivityIndicator size="small" />
          ) : (
            <Text
              size="sm"
              weight="semibold"
              style={styles.inviteAcceptButtonText}
            >
              {t('labels.accept')}
            </Text>
          )}
        </AppPressable>
      </View>
    </View>
  );
};

const CreateHomeScreenComponent = () => {
  const { t } = useTranslation();
  useScreenTransition('CreateHomeScreen');
  const { navigateToNextStep, setUserNavigationState, skipToStep } =
    useOnboardingNavigation();

  const user = useUser();
  const selectedHomeId = useSelectedHomeId();
  const setSelectedHomeId = useAppStore(state => state.setSelectedHomeId);
  const setSelectedPantryId = useSetSelectedPantryId();

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
  const homes = extractNodes(homesData?.homes) as Array<{
    id: string;
    name?: string;
    pantriesConnection?: unknown;
  }>;
  const pendingInvites = extractNodes(
    pendingInvitesData?.me?.pendingHomeInvitesConnection,
  );
  const existingHome = homes[0];
  const existingHomePantries = extractNodes(
    existingHome?.pantriesConnection as never,
  ) as Array<{ id: string; name: string; isDefault?: boolean }>;
  const existingPantry =
    existingHomePantries.find(p => p.isDefault) ?? existingHomePantries[0];
  const needsHome = !existingHome;
  const needsPantry = !existingPantry;
  const hasPendingInvites = pendingInvites.length > 0;

  // GraphQL Mutations
  const [createHome] = useMutation(CreateHomeDocument);
  const [createPantry] = useMutation(CreatePantryDocument, {
    update: (cache, { data }) => {
      if (data?.createPantry?.__typename !== 'CreatePantryPayload') {
        return;
      }
      const newPantry = data.createPantry.pantry;
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
        if (data.acceptHomeInvite?.__typename === 'AcceptHomeInvitePayload') {
          setSelectedHomeId(data.acceptHomeInvite.membership.homeId);
          navigateToNextStep('CreateHome');
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Accept Home Invite' });
      },
    },
  );

  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument, {
    // Note: Declining an invite doesn't add or remove homes from the list,
    // it just changes the invite status. No cache update needed.
    onError: error => {
      handleMutationError(error, { operation: 'Decline Home Invite' });
    },
  });

  // Form Setup
  const form = useForm<FormValues>({
    resolver: yupResolver(
      getCreateHomeSchema(needsHome),
    ) as Resolver<FormValues>,
    defaultValues: {
      homeName: '',
      pantryName: t('onBoarding.defaultPantryName'),
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
          homeNotFoundMessage: t('onBoarding.homeNotFound'),
          createHomeFailedMessage: t('errors.createHomeFailed'),
        }),
      setIsCreating,
      (error: unknown) => {
        setGraphqlError(errorMessageOr(error, t('onBoarding.setupError')));
      },
    );
  };

  const handleAcceptInvite = (token: string) => {
    // Error handled by onError in mutation config
    executeMutation(
      () => acceptHomeInvite({ variables: { input: { token } } }),
      'Failed to accept home invite',
    );
  };

  const handleDeclineInvite = (token: string, homeNameParam: string) => {
    alertService.alert(
      t('confirmations.declineInvitationTitle'),
      t('confirmations.declineHomeInvitation', { homeName: homeNameParam }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.decline'),
          style: 'destructive',
          onPress: () => {
            // Error handled by onError in mutation config
            executeMutation(
              () => declineHomeInvite({ variables: { input: { token } } }),
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
    if (!existingHome) return t('onBoarding.welcomeTitle');
    if (!existingPantry) return t('onBoarding.almostThere');
    return t('onBoarding.allSet');
  };

  const getSubtitle = () => {
    if (!existingHome) return t('onBoarding.createHomeSubtitle');
    if (!existingPantry)
      return t('onBoarding.addPantryToHome', {
        homeName: existingHome.name,
      });
    return t('onBoarding.homeAlreadyConfigured');
  };

  // If user has pending invites and no home, show invitations (unless forcing create form)
  if (hasPendingInvites && !existingHome && !forceShowCreateForm) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.pendingInvitesTitle')}
        subtitle={t('onBoarding.pendingInvitesSubtitle')}
        step={1}
        totalSteps={7}
        onSkip={() => skipToStep('CreateShoppingList')}
      >
        <View style={styles.invitesContainer}>
          <Text size="md" weight="semibold" style={styles.invitesSectionTitle}>
            {t('onBoarding.pendingInvitations')}
          </Text>
          <InviteActionsProvider
            handleAcceptInvite={handleAcceptInvite}
            handleDeclineInvite={handleDeclineInvite}
            accepting={accepting}
          >
            {pendingInvites.map(invite => (
              <InviteCard key={invite.id} inviteRef={invite} />
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
            {t('onBoarding.or')}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title={t('onBoarding.createOwnHome')}
          onPress={() => setForceShowCreateForm(true)}
          variant="secondary"
        />

        <Button
          title={t('onBoarding.skipForNow')}
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
              {t('labels.home')}
            </Text>
            <Text size="lg" weight="semibold">
              {existingHome.name}
            </Text>

            <View style={styles.pantrySection}>
              <Text size="xs" tone="secondary" style={styles.resourceLabel}>
                {t('labels.pantry')}
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
                    {t('labels.default')}
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
            {t('onBoarding.homeAndPantryNote')}
          </Text>
        </View>

        <Button
          title={t('labels.continue')}
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
              {t('onBoarding.existingHome')}
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
        onPress={form.handleSubmit(onSubmit, logValidationErrors)}
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
