import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ListRenderItem,
} from 'react-native';
import Animated, {
  LinearTransition,
  FadeInDown,
} from 'react-native-reanimated';
import { Icon } from '#utils';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useHomeManagement } from '#/hooks';
import { useInviteUserModal } from '#/hooks/useInviteUserModal';
import { useAuth } from '#/hooks/auth/useAuth';
import { AnimatedButton } from '#/components/atoms/AnimatedButton';
import { toastService } from '#/services/toastService';
import {
  HomeStats,
  CreateHomeForm,
  HomeCard,
  PartialHome,
} from '#/components/organisms/home';
import {
  findUserMembership,
  getInvitableRoles,
  canInviteToHome,
} from '#/utils/permissions/homePermissions';
import { commonStyles } from '#/styles';
import { formAnimationPreset } from '#/constants/animations';

export const HomeManagement: React.FC = () => {
  const { goBack, navigate } = useAppNavigation();
  const { user } = useAuth();

  const { theme } = useUnistyles();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [homeName, setHomeName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedHomeId, setHighlightedHomeId] = useState<string | null>(
    null,
  );
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const inviteUserPrompt = useCallback(
    (homeId: string) => {
      // Find the home and user's membership
      const home = homes?.find(h => h.id === homeId);
      if (!home) {
        toastService.error('Home not found');
        return;
      }

      const membership = findUserMembership(home.members, user?.id);
      if (!membership) {
        toastService.error('You are not a member of this home');
        return;
      }

      // Check if user has permission to invite
      if (!canInviteToHome(membership.role)) {
        toastService.error(
          'You do not have permission to invite members to this home',
        );
        return;
      }

      // Get the roles this user can invite
      const allowedRoles = getInvitableRoles(membership.role);

      show({
        title: 'Invite Member to Home',
        allowedRoles,
        onSubmit: async (email, role) => {
          // Just call the function and let any errors bubble up to the modal
          // The modal will handle displaying the error and keeping itself open
          await inviteUserToHome(homeId, email, role);
          // If we reach here, the invitation was successful and the modal will close
        },
      });
    },
    [homes, user, show, inviteUserToHome],
  );

  const handleCreateHome = async () => {
    if (!homeName.trim()) return;

    const result = await createHome(homeName);
    if (result) {
      setHomeName('');
      setShowCreateForm(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setHomeName('');
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

  const handleDeleteHome = useCallback(
    async (homeId: string, name: string) => {
      await deleteHome(homeId, name);
    },
    [deleteHome],
  );

  const handleSetDefault = useCallback(
    async (homeId: string) => {
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
    },
    [setDefaultHome],
  );

  const handleInviteMember = useCallback(
    (homeId: string) => {
      inviteUserPrompt(homeId);
    },
    [inviteUserPrompt],
  );

  const handleViewHomeDetail = useCallback(
    (homeId: string) => {
      navigate('HomeDetail', { homeId });
    },
    [navigate],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchHomes();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Sort homes with default home first
  const sortedHomes = useMemo(() => {
    if (!homes) return [];
    return [...homes].sort((a, b) => {
      if (a.id === defaultHomeId) return -1;
      if (b.id === defaultHomeId) return 1;
      return 0;
    });
  }, [homes, defaultHomeId]);

  // Render individual home item
  const renderHomeItem: ListRenderItem<(typeof sortedHomes)[0]> = useCallback(
    ({ item: home, index }) => {
      const membership = findUserMembership(home.members, user?.id);
      const userCanInvite = membership
        ? canInviteToHome(membership.role)
        : false;

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
            home={home as PartialHome}
            isDefault={home.id === defaultHomeId}
            isHighlighted={home.id === highlightedHomeId}
            canInvite={userCanInvite}
            onPress={handleViewHomeDetail}
            onSetDefault={handleSetDefault}
            onInvite={handleInviteMember}
            onDelete={handleDeleteHome}
          />
        </Animated.View>
      );
    },
    [
      defaultHomeId,
      highlightedHomeId,
      user,
      handleViewHomeDetail,
      handleSetDefault,
      handleInviteMember,
      handleDeleteHome,
    ],
  );

  // Only show loading screen on initial load (no cached data)
  // Once we have data, show it immediately even if refetching
  if (initialLoading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <View style={commonStyles.container}>
        {/* Header */}
        <View style={commonStyles.header}>
          <TouchableOpacity onPress={goBack}>
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={commonStyles.headerTitle}>My Homes</Text>
          <TouchableOpacity onPress={() => setShowCreateForm(true)}>
            <Icon name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <HomeStats
          totalHomes={stats.totalHomes}
          totalMembers={stats.totalMembers}
          totalPantries={stats.totalPantries}
        />

        {/* Create/Join Home Form */}
        {showCreateForm && (
          <Animated.View
            {...formAnimationPreset}
            style={[commonStyles.cardWithShadow, styles.formContainer]}
          >
            {/* Mode Switcher */}
            <View style={styles.modeSwitcher}>
              <TouchableOpacity
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
                  Create Home
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
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
                  Join with Code
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'create' ? (
              <CreateHomeForm
                isVisible={true}
                homeName={homeName}
                onHomeNameChange={setHomeName}
                onSubmit={handleCreateHome}
                onCancel={handleCancelCreate}
                isCreating={creating}
              />
            ) : (
              /* Join Home Form */
              <View style={styles.joinForm}>
                <Text style={styles.joinFormTitle}>Enter Join Code</Text>
                <Text style={styles.joinFormSubtitle}>
                  Ask a home member for the join code to join their home
                </Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Join Code</Text>
                  <TextInput
                    style={[commonStyles.input, styles.textInput]}
                    placeholder="Enter code here..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    onBlur={handlePreviewHome}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Preview */}
                {loadingPreview && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                    style={styles.previewLoader}
                  />
                )}
                {previewHome && (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>{previewHome.name}</Text>
                    <Text style={styles.previewSubtitle}>
                      {previewHome.members?.length || 0} member(s)
                    </Text>
                    {previewHome.description && (
                      <Text style={styles.previewDescription}>
                        {previewHome.description}
                      </Text>
                    )}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleCancelCreate}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <AnimatedButton
                    loading={joiningByCode}
                    disabled={!joinCode.trim()}
                    onPress={handleJoinHome}
                    variant="primary"
                    style={styles.button}
                  >
                    Join Home
                  </AnimatedButton>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Homes List - Virtualized */}
        <Animated.View
          layout={LinearTransition.duration(300)}
          style={styles.scrollView}
        >
          <FlatList
            data={sortedHomes}
            keyExtractor={item => item.id}
            renderItem={renderHomeItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            contentContainerStyle={{ flexGrow: 1 }}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: 128, // HomeCard height (~120px) + marginVertical (8px)
              offset: 128 * index,
              index,
            })}
          />
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
    gap: theme.spacing.md,
  },
  joinFormTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  joinFormSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: -theme.spacing.sm,
  },
  inputContainer: {
    gap: theme.spacing.sm,
  },
  inputLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  textInput: {
    textTransform: 'uppercase',
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
  formActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
