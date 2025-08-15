import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {ShoppingListDetailNavProp} from '#/navigation';
import {useHomeManagement} from '#/hooks';
import {useEmailInputModal} from '#/hooks/useEmailInputModal';

export const HomeManagement: React.FC = () => {
  const {styles, theme} = useStyles(stylesheet);
  const navigation = useNavigation<ShoppingListDetailNavProp>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [homeName, setHomeName] = useState('');

  const {
    homes,
    defaultHomeId,
    loading,
    creating,
    createHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    stats,
  } = useHomeManagement();

  const {show, hide, EmailModalComponent} = useEmailInputModal();

  // Update inviteUserPrompt
  const inviteUserPrompt = (homeId: string) => {
    show({
      title: 'Invite Member',
      placeholder: 'Enter email address',
      onSubmit: async email => {
        const success = await inviteUserToHome(homeId, email);
        if (!success) {
          throw new Error('Failed to invite user');
        }
        hide();
      },
    });
  };
  const handleCreateHome = async () => {
    const result = await createHome(homeName);
    if (result) {
      setHomeName('');
      setShowCreateForm(false);
    }
  };

  const handleDeleteHome = async (homeId: string, homeName: string) => {
    await deleteHome(homeId, homeName);
  };

  const handleSetDefault = async (homeId: string) => {
    await setDefaultHome(homeId);
  };

  const handleInviteMember = (homeId: string) => {
    inviteUserPrompt(homeId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          {/* Go Back */}
          <TouchableOpacity onPress={() => navigation.goBack()}>
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
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalHomes}</Text>
            <Text style={styles.statLabel}>
              {stats.totalHomes === 1 ? 'Home' : 'Homes'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>
              {stats.totalMembers === 1 ? 'Member' : 'Members'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalPantries}</Text>
            <Text style={styles.statLabel}>
              {stats.totalPantries === 1 ? 'Pantry' : 'Pantries'}
            </Text>
          </View>
        </View>

        {showCreateForm && (
          <View style={styles.createForm}>
            <TextInput
              style={styles.input}
              value={homeName}
              onChangeText={setHomeName}
              placeholder="Enter home name"
              autoFocus
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowCreateForm(false);
                  setHomeName('');
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.createButton]}
                onPress={handleCreateHome}
                disabled={creating}>
                {creating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.createButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled" // Add this
          keyboardDismissMode="on-drag">
          {homes.map(home => (
            <View key={home.id} style={styles.homeCard}>
              <View style={styles.homeHeader}>
                <View style={styles.homeInfo}>
                  <Text style={styles.homeName}>{home.name}</Text>
                  <Text style={styles.homeDetails}>
                    {home.members?.length || 0} members •{' '}
                    {home.pantries?.length || 0} pantries
                  </Text>
                </View>
                {home.id == defaultHomeId && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </View>

              <View style={styles.homeActions}>
                {home.id !== defaultHomeId && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleSetDefault(home.id)}>
                    <Icon
                      name="star-outline"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.actionText}>Set Default</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleInviteMember(home.id)}>
                  <Icon
                    name="person-add"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.actionText}>Invite</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteHome(home.id, home.name)}>
                  <Icon name="delete" size={20} color={theme.colors.error} />
                  <Text
                    style={[styles.actionText, {color: theme.colors.error}]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>

              {home.members && home.members.length > 0 && (
                <View style={styles.membersSection}>
                  <Text style={styles.membersSectionTitle}>Members</Text>
                  <View style={styles.membersList}>
                    {home.members.map(member => (
                      <View key={member.id} style={styles.memberChip}>
                        <Text style={styles.memberChipText}>
                          {member?.user?.profile?.firstName ||
                            member?.user?.email}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
      {EmailModalComponent}
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  createForm: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: 'white',
  },
  homeCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  homeInfo: {
    flex: 1,
  },
  homeName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  homeDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  homeActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  membersSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  memberChipText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
}));
