import React, { useState, useEffect, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { handleMutationError } from '#/utils/errorHandlers';
import { localizedErrorMessage } from '#/services/errorService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { formatRole } from '#utils/formatters/roleFormatters';
import { InviteCard_InviteFragmentDoc } from './CreateHomeScreen.generated';
import type { FragmentType } from '@apollo/client/masking';
import {
  InviteActionsProvider,
  useInviteActions,
} from './InviteActionsContext';

import { FormContent, type FormValues } from './FormContent';
import { LoadingView } from './LoadingView';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { SubmitButton } from './SubmitButton';
import { ErrorMessage } from './ErrorMessage';
import { Button } from '#components/atoms/Button';

import { useFragment } from '@apollo/client/react';
import { HomeType } from '#/graphql/generated/schemaTypes';
import {
  useCreatePantry,
  type CreatePantryFn,
} from '#features/pantry/hooks/useCreatePantry';
import {
  useCreateHomeFlow,
  type CreateHomeFn,
} from '#features/onboarding/hooks/useCreateHomeFlow';

import {
  useAppStore,
  useHasUnverifiedEmail,
  useSelectedHomeId,
  useSetSelectedPantryId,
  useUser,
} from '#store/useAppStore';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';

import { getCreateHomeSchema } from '#features/onboarding/utils/validation';
import { logValidationErrors } from '#/utils/validation/common';
import { createPantryForHome, showPantryCreationError } from './helpers';
import { extractNodes } from '#/utils/connectionUtils';
import { OnboardingErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';

/** Module scope so the try/catch does not bail the component out of the compiler. */
async function performCreateHome(
  data: FormValues,
  deps: {
    needsHome: boolean;
    needsPantry: boolean;
    hasUnverifiedEmail: boolean;
    selectedHomeId: string | null;
    createHome: CreateHomeFn;
    createPantry: CreatePantryFn;
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
      name: data.homeName.trim(),
      description: 'Created during onboarding',
      type: HomeType.Household,
      isPublic: false,
      // Asking for a join code while the email is unverified makes the server
      // refuse the whole mutation, dead-ending onboarding for anyone who
      // deferred verification. A join code can be enabled later in settings.
      allowJoinCode: !deps.hasUnverifiedEmail,
      createDefaultPantry: true,
      defaultPantryName: data.pantryName.trim(),
      tags: ['onboarding'],
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

const InviteCard: React.FC<{
  inviteRef: FragmentType<typeof InviteCard_InviteFragmentDoc>;
}> = ({ inviteRef }) => {
  const { t } = useTranslation();
  const { handleAcceptInvite, handleDeclineInvite, accepting } =
    useInviteActions();

  // Fragment colocation makes this card re-render only on ITS invite's changes.
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

  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [forceShowCreateForm, setForceShowCreateForm] = useState(false);

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

  const {
    pendingInvites,
    existingHome,
    existingPantry,
    needsHome,
    needsPantry,
    homesLoading,
    invitesLoading,
    accepting,
    createHome,
    acceptHomeInvite,
    declineHomeInvite,
  } = useCreateHomeFlow({
    userId: user?.id,
    onInviteAccepted: homeId => {
      setSelectedHomeId(homeId);
      navigateToNextStep('CreateHome');
    },
    onInviteError: error => {
      handleMutationError(error, { operation: 'Accept Home Invite' });
    },
    onDeclineError: error => {
      handleMutationError(error, { operation: 'Decline Home Invite' });
    },
  });
  const { createPantry } = useCreatePantry();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const hasPendingInvites = pendingInvites.length > 0;

  const form = useForm<FormValues>({
    resolver: yupResolver(
      getCreateHomeSchema(needsHome),
    ) as Resolver<FormValues>,
    defaultValues: {
      homeName: '',
      pantryName: t('onBoarding.defaultPantryName'),
    },
  });

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

  const onSubmit = (data: FormValues) => {
    setGraphqlError(null);

    executeWithLoadingState(
      () =>
        performCreateHome(data, {
          needsHome,
          needsPantry,
          hasUnverifiedEmail,
          selectedHomeId,
          createHome,
          createPantry,
          setSelectedHomeId,
          setSelectedPantryId,
          skipToStep,
          navigateToNextStep,
          homeNotFoundMessage: t('onBoarding.homeNotFound'),
          createHomeFailedMessage: t('errors.createHomeFailed'),
        }),
      setIsCreating,
      (error: unknown) => {
        setGraphqlError(
          localizedErrorMessage(error, t('onBoarding.setupError')),
        );
      },
    );
  };

  const handleAcceptInvite = async (token: string) => {
    // Error handled by onError in mutation config
    try {
      await acceptHomeInvite(token);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to accept home invite',
      });
    }
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
          onPress: async () => {
            // Error handled by onError in mutation config
            try {
              await declineHomeInvite(token);
            } catch (error) {
              errorService.reportError(error, {
                operation: 'Failed to decline home invite',
              });
            }
          },
        },
      ],
    );
  };

  if (checkingExisting || homesLoading || invitesLoading) {
    return <LoadingView onSkip={() => skipToStep('CreateShoppingList')} />;
  }

  const getTitle = () => {
    if (!existingHome) return t('onBoarding.welcomeTitle');
    if (!existingPantry) return t('onBoarding.almostThere');
    return t('labels.youReAllSet');
  };

  const getSubtitle = () => {
    if (!existingHome) return t('onBoarding.createHomeSubtitle');
    if (!existingPantry)
      return t('onBoarding.addPantryToHome', {
        homeName: existingHome.name,
      });
    return t('onBoarding.homeAlreadyConfigured');
  };

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
            {t('labels.pendingInvitations')}
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

// A screen-level boundary keeps a mutation failure from resetting the whole app.
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
    borderWidth: theme.borderWidth.hairline,
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
    borderTopWidth: theme.borderWidth.hairline,
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
    borderWidth: theme.borderWidth.hairline,
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
    borderWidth: theme.borderWidth.hairline,
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
    borderWidth: theme.borderWidth.hairline,
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
    color: theme.colors.onPrimary,
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
