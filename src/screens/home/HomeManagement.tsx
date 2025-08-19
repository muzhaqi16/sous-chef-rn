import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {useHomeManagement} from '#/hooks';
import {useEmailInputModal} from '#/hooks/useEmailInputModal';
import {
  HomeStats,
  CreateHomeForm,
  HomeCard,
  PartialHome,
} from '#/components/organisms/home';
import { HomeManagementNavProp } from '#/navigation';

export const HomeManagement: React.FC = () => {
  const {styles, theme} = useStyles(stylesheet);
  const navigation = useNavigation<HomeManagementNavProp>();
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

  const {show, EmailModalComponent} = useEmailInputModal();

  const inviteUserPrompt = (homeId: string) => {
    show({
      title: 'Invite Member',
      placeholder: 'Enter email address',
      onSubmit: async email => {
        const success = await inviteUserToHome(homeId, email);
        if (!success) {
          throw new Error('Failed to invite user');
        }
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
        {/* Header */}
        <View style={styles.header}>
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
          keyboardDismissMode="on-drag">
          {homes.map(home => (
            <HomeCard
              key={home.id}
              home={home as PartialHome}
              isDefault={home.id === defaultHomeId}
              onSetDefault={handleSetDefault}
              onInvite={handleInviteMember}
              onDelete={handleDeleteHome}
            />
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
  scrollView: {
    flex: 1,
  },
}));
