import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation, useHomeDetailManagement } from '#hooks';
import { commonStyles } from '#styles';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { EditableField, NavigationRow } from '#components/molecules';
import { HomeMembersSection } from '#components/organisms/home';
import { useStore } from '#store';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { goBack, navigate } = useAppNavigation();
  const { homeId } = route.params;
  const currentUser = useStore(state => state.user);
  const { theme } = useUnistyles();

  const { home, loading, saveName, changeRole, removeMember, revokeInvite } =
    useHomeDetailManagement(homeId);

  if (loading || !home) {
    return (
      <DetailTemplate
        title="Home Details"
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={commonStyles.body}>
                  {loading ? 'Loading...' : 'Home not found'}
                </Text>
              </View>
            ),
          },
        ]}
      />
    );
  }

  const sections = [
    {
      title: 'Home Information',
      content: (
        <EditableField
          label="Home Name"
          value={home.name}
          onSave={saveName}
          placeholder="Enter home name"
          validation={(value) => {
            if (!value.trim()) {
              return 'Home name cannot be empty';
            }
            return null;
          }}
        />
      ),
    },
    {
      title: 'Members & Invites',
      content: (
        <HomeMembersSection
          members={home.members || []}
          invites={home.invites || []}
          currentUserId={currentUser?.id}
          onChangeRole={changeRole}
          onRemove={removeMember}
          onRevokeInvite={revokeInvite}
        />
      ),
    },
    {
      title: 'Storage Management',
      content: (
        <NavigationRow
          icon="folder-open"
          iconColor={theme.colors.primary}
          title="Storage Locations"
          subtitle="Manage where items are stored"
          onPress={() => navigate('StorageLocations', { homeId })}
        />
      ),
    },
  ];

  return (
    <DetailTemplate
      title="Home Details"
      onBack={goBack}
      headerActions={[]}
      sections={sections}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
}));
