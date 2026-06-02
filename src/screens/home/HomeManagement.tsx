import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  PrimaryActivityIndicator,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  LinearTransition,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '#components/molecules/Header';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { useHomeManagement } from '#hooks/home/hooks/useHomeManagement';
import { useInviteUserModal } from '#/hooks/useInviteUserModal';
import { BaseInput } from '#/components/atoms/BaseInput/BaseInput';
import { Button } from '#/components/base/Button';
import { toastService } from '#/services/toastService';
import { HomeStats } from '#/components/organisms/home/HomeStats';
import { CreateHomeForm } from '#/components/organisms/home/CreateHomeForm';
import { HomeCard } from '#/components/organisms/home/HomeCard';
import {
  getInvitableRoles,
  canInviteToHome,
} from '#/utils/permissions/homePermissions';
import { commonStyles } from '#/styles/commonStyles';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export const HomeManagement: React.FC = () => {
  useScreenTransition('HomeManagement');
  const { t } = useTranslation();
  const { goBack, toHomeDetail } = useAppNavigation();
  const insets = useSafeAreaInsets();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [homeName, setHomeName] = useState('');
  const [allowJoinCode, setAllowJoinCode] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedHomeId, setHighlightedHomeId] = useState<string | null>(
    null,
  );
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any in-flight highlight timer on unmount to prevent setState on
  // an unmounted component if the user navigates away within 2s of setting
  // a default home.
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  const {
    homes,
    defaultHomeId,
    initialLoading,
    creating,
    joiningByCode,
    loadingPreview,
    previewHome,
    createHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    joinHomeByCode,
    previewHomeByCode,
    stats,
    refetch: refetchHomes,
  } = useHomeManagement();

  // Note: Removed useFocusEffect refetch to prevent flickering
  // Apollo's cache-and-network + cache-first strategy handles data freshness
  // Mutations (create, delete, update) automatically update the cache

  const { show, InviteModalComponent } = useInviteUserModal();
  const inviteUserPrompt = (homeId: string) => {
    // Find the home and user's membership
    const home = homes?.find(h => h.id === homeId);
    if (!home) {
      toastService.error(t('homeManagement.errorHomeNotFound'));
      return;
    }

    const membership = home.myMembership;
    if (!membership) {
      toastService.error(t('homeManagement.errorNotMember'));
      return;
    }

    // Check if user has permission to invite
    if (!canInviteToHome(membership.role, membership.canInviteOthers)) {
      toastService.error(t('homeManagement.errorNoInvitePermission'));
      return;
    }

    // Get the roles this user can invite
    const allowedRoles = getInvitableRoles(
      membership.role,
      membership.canInviteOthers,
    );

    show({
      title: t('homeManagement.inviteModalTitle'),
      allowedRoles,
      onSubmit: async (email, role) => {
        // Just call the function and let any errors bubble up to the modal
        // The modal will handle displaying the error and keeping itself open
        await inviteUserToHome(homeId, email, role);
        // If we reach here, the invitation was successful and the modal will close
      },
    });
  };

  const handleCreateHome = async () => {
    if (!homeName.trim()) return;

    const result = await createHome({ name: homeName, allowJoinCode });
    if (result) {
      setHomeName('');
      setAllowJoinCode(true);
      setShowCreateForm(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setHomeName('');
    setAllowJoinCode(true);
    setJoinCode('');
    setMode('create');
  };

  const handleJoinHome = async () => {
    if (!joinCode.trim()) return;

    const result = await joinHomeByCode(joinCode);
    if (result) {
      setJoinCode('');
      setShowCreateForm(false);
    }
  };

  const handlePreviewHome = async () => {
    if (joinCode.trim().length > 3) {
      await previewHomeByCode(joinCode);
    }
  };

  const handleSetDefault = async (homeId: string) => {
    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    await setDefaultHome(homeId);

    // Highlight the newly-set default home
    setHighlightedHomeId(homeId);

    // Auto-dismiss highlight after 2 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedHomeId(null);
    }, 2000);
  };

  const handleViewHomeDetail = (homeId: string) => {
    toHomeDetail({ homeId });
  };

  const handleRefresh = () => {
    executeWithLoadingState(
      async () => {
        await refetchHomes();
      },
      setRefreshing,
      error => {
        errorService.reportError(error, {
          operation: 'HomeManagement.refreshData',
        });
      },
    );
  };

  // Sort homes with default home first
  const sortedHomes = (() => {
    if (!homes) return [];
    return [...homes].sort((a, b) => {
      if (a.id === defaultHomeId) return -1;
      if (b.id === defaultHomeId) return 1;
      return 0;
    });
  })();

  // Only show loading screen on initial load (no cached data)
  // Once we have data, show it immediately even if refetching
  if (initialLoading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <SousChefLoader
          size="small"
          showBrand={false}
          message={t('homeManagement.loadingMessage')}
        />
      </View>
    );
  }

  return (
    <>
      <View style={commonStyles.container}>
        {/* Header */}
        <Header
          title={t('homeManagement.title')}
          centerTitle
          onBack={goBack}
          rightActions={[
            {
              icon: 'add',
              onPress: () => setShowCreateForm(true),
              variant: 'primary',
            },
          ]}
        />

        {/* Stats Section */}
        <HomeStats
          totalHomes={stats.totalHomes}
          totalMembers={stats.totalMembers}
          totalPantries={stats.totalPantries}
        />

        {/* Create/Join Home Form - slides down inline */}
        {!!showCreateForm && (
          <Animated.View
            entering={FadeInDown.duration(TIMING.SLOW).springify()}
            exiting={FadeOutUp.duration(TIMING.STANDARD)}
            layout={LinearTransition.duration(TIMING.SLOW)}
            style={[commonStyles.cardWithShadow, styles.formContainer]}
          >
            {/* Mode Switcher */}
            <View style={styles.modeSwitcher}>
              <AppPressable
                style={[
                  styles.modeButton,
                  mode === 'create' && styles.modeButtonActive,
                ]}
                onPress={() => setMode('create')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'create' && styles.modeButtonTextActive,
                  ]}
                >
                  {t('homeManagement.modeCreate')}
                </Text>
              </AppPressable>
              <AppPressable
                style={[
                  styles.modeButton,
                  mode === 'join' && styles.modeButtonActive,
                ]}
                onPress={() => setMode('join')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'join' && styles.modeButtonTextActive,
                  ]}
                >
                  {t('homeManagement.modeJoin')}
                </Text>
              </AppPressable>
            </View>

            {mode === 'create' ? (
              <CreateHomeForm
                isVisible={true}
                homeName={homeName}
                onHomeNameChange={setHomeName}
                allowJoinCode={allowJoinCode}
                onAllowJoinCodeChange={setAllowJoinCode}
                onSubmit={handleCreateHome}
                onCancel={handleCancelCreate}
                isCreating={creating}
              />
            ) : (
              /* Join Home Form - uses same components as CreateHomeForm */
              <View style={styles.joinForm}>
                <BaseInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  onBlur={handlePreviewHome}
                  placeholder={t('homeManagement.joinCodePlaceholder')}
                  autoCapitalize="characters"
                />
                {/* Preview - only shows when code is validated */}
                {!!loadingPreview && (
                  <PrimaryActivityIndicator
                    size="small"
                    style={styles.previewLoader}
                  />
                )}
                {!!previewHome && (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>{previewHome.name}</Text>
                    <Text style={styles.previewSubtitle}>
                      {t('homeManagement.joinCodeMemberCount', {
                        count: previewHome.membersConnection?.totalCount ?? 0,
                      })}
                    </Text>
                  </View>
                )}
                {/* Actions - same as CreateHomeForm */}
                <View style={styles.formActions}>
                  <Button
                    variant="secondary"
                    onPress={handleCancelCreate}
                    fullWidth
                  >
                    {t('homeManagement.cancel')}
                  </Button>
                  <Button
                    loading={joiningByCode}
                    disabled={!joinCode.trim()}
                    onPress={handleJoinHome}
                    variant="primary"
                    style={styles.actionButton}
                  >
                    {t('homeManagement.join')}
                  </Button>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Homes List */}
        <Animated.View
          layout={LinearTransition.duration(TIMING.SLOW)}
          style={[styles.scrollView, { paddingBottom: insets.bottom }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ flexGrow: 1 }}
            refreshControl={
              <ThemedRefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {/* NOTE: Per-item entering + LinearTransition layout animations on
                a `.map()`-rendered list are acceptable here because the home
                list is bounded (typically <10 items). For longer lists, prefer
                a single FlashList `itemLayoutAnimation` or stagger-gate the
                entering animations after the first render — see
                js-animations-reanimated.md for the long-list pattern. */}
            {sortedHomes.map((home, index) => {
              const userCanInvite = home.myMembership
                ? canInviteToHome(
                    home.myMembership.role,
                    home.myMembership.canInviteOthers,
                  )
                : false;
              const userCanDelete = home.myMembership?.canManageHome ?? false;

              return (
                <Animated.View
                  key={home.id}
                  entering={FadeInDown.delay(index * 50).springify()}
                  layout={LinearTransition.duration(600)
                    .springify()
                    .damping(30)
                    .stiffness(180)
                    .mass(1.5)}
                >
                  <HomeCard
                    homeRef={home}
                    isDefault={home.id === defaultHomeId}
                    isHighlighted={home.id === highlightedHomeId}
                    canInvite={userCanInvite}
                    canDelete={userCanDelete}
                    onPress={handleViewHomeDetail}
                    onSetDefault={handleSetDefault}
                    onInvite={inviteUserPrompt}
                    onDelete={deleteHome}
                  />
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
      {InviteModalComponent}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  formContainer: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  modeButtonTextActive: {
    color: theme.colors.white,
  },
  joinForm: {
    backgroundColor: theme.colors.surface,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  previewLoader: {
    marginVertical: theme.spacing.sm,
  },
  previewCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    gap: theme.spacing.xs,
  },
  previewTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  previewSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  previewDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
