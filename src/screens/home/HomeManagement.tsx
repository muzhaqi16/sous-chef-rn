import React, { useState } from 'react';
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
import { Icon } from '#utils';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useHomeManagement } from '#/hooks';
import { useInviteUserModal } from '#/hooks/useInviteUserModal';
import { useAuth } from '#/hooks/auth/useAuth';
import {
  HomeStats,
  CreateHomeForm,
  HomeCard,
  PartialHome,
} from '#/components/organisms/home';
import {
  useGetMyPendingInvitesQuery,
  useAcceptHomeInviteMutation,
  useDeclineHomeInviteMutation,
  GetHomesDocument,
} from '#generated';
import { formatRole } from '#utils/formatters';
import {
  findUserMembership,
  getInvitableRoles,
  canInviteToHome,
} from '#/utils/permissions/homePermissions';

export const HomeManagement: React.FC = () => {
  const { goBack, navigate } = useAppNavigation();
  const { user } = useAuth();

  const { theme } = useUnistyles();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [homeName, setHomeName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch pending home invitations
  const {
    data: pendingInvitesData,
    loading: invitesLoading,
    refetch: refetchPendingInvites,
  } = useGetMyPendingInvitesQuery({
    fetchPolicy: 'cache-and-network',
  });

  const [acceptHomeInvite, { loading: accepting }] =
    useAcceptHomeInviteMutation({
      refetchQueries: [{ query: GetHomesDocument }],
      onError: error => {
        Alert.alert('Error', error.message || 'Failed to accept invitation');
      },
    });

  const [declineHomeInvite, { loading: declining }] =
    useDeclineHomeInviteMutation({
      refetchQueries: [{ query: GetHomesDocument }],
      onError: error => {
        Alert.alert('Error', error.message || 'Failed to decline invitation');
      },
    });

  const pendingInvites = pendingInvitesData?.myPendingInvites || [];

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
    await setDefaultHome(homeId);
  };

  const handleInviteMember = (homeId: string) => {
    inviteUserPrompt(homeId);
  };

  const handleViewHomeDetail = (homeId: string) => {
    navigate('HomeDetail', { homeId });
  };

  const handleAcceptInvite = async (token: string) => {
    try {
      await acceptHomeInvite({ variables: { token } });
    } catch (error) {
      // Error is handled by onError in mutation
    }
  };

  const handleDeclineInvite = (token: string, inviteHomeName: string) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${inviteHomeName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineHomeInvite({ variables: { token } });
            } catch (error) {
              // Error is handled by onError in mutation
            }
          },
        },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchHomes(), refetchPendingInvites()]);
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
          <View style={styles.formContainer}>
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
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.submitButton,
                      (!joinCode.trim() || joiningByCode) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={handleJoinHome}
                    disabled={!joinCode.trim() || joiningByCode}
                  >
                    {joiningByCode ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Join Home</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Pending Invitations */}
        {!invitesLoading && pendingInvites.length > 0 && (
          <View style={styles.invitesContainer}>
            <Text style={styles.invitesSectionTitle}>Pending Invitations</Text>
            <Text style={styles.invitesSubtitle}>
              You have been invited to join the following homes
            </Text>
            {pendingInvites.map(invite => {
              const inviterName =
                invite.inviter?.profile?.displayName ||
                invite.inviter?.email ||
                'Someone';
              const inviteHomeName = invite.home?.name || 'Unknown Home';

              return (
                <View key={invite.id} style={styles.inviteCard}>
                  {/* Header with icon */}
                  <View style={styles.inviteCardHeader}>
                    <Icon
                      name="home"
                      size={24}
                      color={theme.colors.primary}
                      library="Ionicons"
                    />
                    <Text style={styles.inviteCardTitle}>
                      Invitation to Join Home
                    </Text>
                  </View>

                  {/* Home name - prominent */}
                  <Text style={styles.inviteHomeName}>{inviteHomeName}</Text>

                  {/* Invitation details */}
                  <View style={styles.inviteDetailsContainer}>
                    <View style={styles.inviteDetailRow}>
                      <Icon
                        name="person"
                        size={16}
                        color={theme.colors.textSecondary}
                        library="Ionicons"
                      />
                      <Text style={styles.inviteDetailLabel}>From:</Text>
                      <Text style={styles.inviteDetailValue}>
                        {inviterName}
                      </Text>
                    </View>

                    <View style={styles.inviteDetailRow}>
                      <Icon
                        name="shield-checkmark"
                        size={16}
                        color={theme.colors.textSecondary}
                        library="Ionicons"
                      />
                      <Text style={styles.inviteDetailLabel}>Role:</Text>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>
                          {formatRole(invite.role)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={[styles.button, styles.inviteDeclineButton]}
                      onPress={() =>
                        handleDeclineInvite(invite.token, inviteHomeName)
                      }
                      disabled={declining}
                    >
                      <Text style={styles.inviteDeclineButtonText}>
                        Decline
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.inviteAcceptButton]}
                      onPress={() => handleAcceptInvite(invite.token)}
                      disabled={accepting}
                    >
                      {accepting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.inviteAcceptButtonText}>
                          Accept
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Homes List */}
        <ScrollView
          style={styles.scrollView}
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
            .map(home => {
              // Calculate if user can invite to this home
              const membership = findUserMembership(home.members, user?.id);
              const userCanInvite = membership
                ? canInviteToHome(membership.role)
                : false;

              return (
                <HomeCard
                  key={home.id}
                  home={home as PartialHome}
                  isDefault={home.id === defaultHomeId}
                  canInvite={userCanInvite}
                  onPress={handleViewHomeDetail}
                  onSetDefault={handleSetDefault}
                  onInvite={handleInviteMember}
                  onDelete={handleDeleteHome}
                />
              );
            })}
        </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    color: '#fff',
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
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  invitesContainer: {
    padding: 16,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  invitesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  invitesSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  inviteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  inviteCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteHomeName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
    lineHeight: 28,
  },
  inviteDetailsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  inviteDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    minWidth: 50,
  },
  inviteDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  roleBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteDeclineButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteDeclineButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  inviteAcceptButton: {
    backgroundColor: theme.colors.primary,
  },
  inviteAcceptButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
}));
