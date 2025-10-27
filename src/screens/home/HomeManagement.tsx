import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '#utils';
import { useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useHomeManagement } from '#/hooks';
import { useInviteUserModal } from '#/hooks/useInviteUserModal';
import {
  HomeStats,
  CreateHomeForm,
  HomeCard,
  PartialHome,
} from '#/components/organisms/home';

export const HomeManagement: React.FC = () => {
  const { goBack, navigate } = useAppNavigation();

  const { theme } = useUnistyles();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [homeName, setHomeName] = useState('');

  const {
    homes,
    defaultHomeId,
    initialLoading,
    creating,
    createHome,
    deleteHome,
    setDefaultHome,
    inviteUserToHome,
    stats,
  } = useHomeManagement();

  // Note: Removed useFocusEffect refetch to prevent flickering
  // Apollo's cache-and-network + cache-first strategy handles data freshness
  // Mutations (create, delete, update) automatically update the cache

  const { show, InviteModalComponent } = useInviteUserModal();
  const inviteUserPrompt = (homeId: string) => {
    show({
      title: 'Invite Member to Home',
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

        {/* Create Home Form */}
        <CreateHomeForm
          isVisible={showCreateForm}
          homeName={homeName}
          onHomeNameChange={setHomeName}
          onSubmit={handleCreateHome}
          onCancel={handleCancelCreate}
          isCreating={creating}
        />

        {/* Homes List */}
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {[...homes]
            .sort((a, b) => {
              // Put default home first, keep rest in original order
              if (a.id === defaultHomeId) return -1;
              if (b.id === defaultHomeId) return 1;
              return 0;
            })
            .map(home => (
              <HomeCard
                key={home.id}
                home={home as PartialHome}
                isDefault={home.id === defaultHomeId}
                onPress={handleViewHomeDetail}
                onSetDefault={handleSetDefault}
                onInvite={handleInviteMember}
                onDelete={handleDeleteHome}
              />
            ))}
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
}));
