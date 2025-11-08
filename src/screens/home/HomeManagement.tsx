import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
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
  const inviteUserPrompt = (homeId: string) => {
    // Find the home and user's membership
    const home = homes?.find(h => h.id === homeId);
    if (!home) {
      Alert.alert('Error', 'Home not found');
      return;
    }

    const membership = findUserMembership(home.members, user?.id);
    if (!membership) {
      Alert.alert('Error', 'You are not a member of this home');
      return;
    }

    // Check if user has permission to invite
    if (!canInviteToHome(membership.role)) {
      Alert.alert(
        'Permission Denied',
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
  };

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

  const handleDeleteHome = async (homeId: string, name: string) => {
    await deleteHome(homeId, name);
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

  const handleInviteMember = (homeId: string) => {
    inviteUserPrompt(homeId);
  };

  const handleViewHomeDetail = (homeId: string) => {
    navigate('HomeDetail', { homeId });
  };

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

  // Only show loading screen on initial load (no cached data)
  // Once we have data, show it immediately even if refetching
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack}>
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Homes</Text>
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
            style={[commonStyles.shadow, styles.formContainer]}
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
                    style={styles.textInput}
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

        {/* Homes List */}
        <Animated.View
          layout={LinearTransition.duration(300)}
          style={styles.scrollView}
        >
          <ScrollView
            style={{ flex: 1 }}
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
          >
          {[...homes]
            .sort((a, b) => {
              // Put default home first, keep rest in original order
              if (a.id === defaultHomeId) return -1;
              if (b.id === defaultHomeId) return 1;
              return 0;
            })
            .map((home, index) => {
              // Calculate if user can invite to this home
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
            })}
        </ScrollView>
        </Animated.View>
      </View>
      {InviteModalComponent}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    backgroundColor: theme.colors.background,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.lg,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  modeButtonTextActive: {
    color: theme.colors.white,
  },
  joinForm: {
    gap: 16,
  },
  joinFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  joinFormSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: -8,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  previewLoader: {
    marginVertical: 8,
  },
  previewCard: {
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    gap: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  previewSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewDescription: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
