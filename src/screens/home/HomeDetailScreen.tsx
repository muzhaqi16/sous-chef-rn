import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppNavigation, useHomeDetailManagement } from '#hooks';
import { commonStyles } from '#styles';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { EditableField, NavigationRow } from '#components/molecules';
import { HomeMembersSection } from '#components/organisms/home';
import { useAppStore, selectUser } from '#store/useAppStore';
import { Icon } from '#utils';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  const { goBack, navigate } = useAppNavigation();
  const { homeId } = route.params;
  // PERFORMANCE: Use selective selector instead of full store subscription
  const currentUser = useAppStore(selectUser);
  const { theme } = useUnistyles();

  const [copied, setCopied] = useState(false);

  const { home, loading, saveName, changeRole, removeMember, revokeInvite } =
    useHomeDetailManagement(homeId);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopyJoinCode = () => {
    if (home?.joinCode) {
      Clipboard.setString(home.joinCode);
      setCopied(true);
    }
  };

  // Find current user's membership to check permissions
  const currentUserMembership = home?.members?.find(
    member => member.userId === currentUser?.id
  );

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
        <>
          <EditableField
            label="Home Name"
            value={home.name}
            onSave={saveName}
            placeholder="Enter home name"
            validation={value => {
              if (!value.trim()) {
                return 'Home name cannot be empty';
              }
              return null;
            }}
          />
          {home.allowJoinCode && home.joinCode && (
            <View style={styles.joinCodeRow}>
              <View style={styles.joinCodeContent}>
                <Text style={styles.joinCodeLabel}>Join Code</Text>
                <Text style={styles.joinCodeValue}>{home.joinCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyJoinCode}
              >
                <Icon
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  color={copied ? theme.colors.success : theme.colors.textPrimary}
                  library="Ionicons"
                />
              </TouchableOpacity>
            </View>
          )}
        </>
      ),
    },
    {
      title: 'Members & Invites',
      content: (
        <HomeMembersSection
          members={home.members || []}
          invites={home.invites || []}
          currentUserId={currentUser?.id}
          currentUserMembership={currentUserMembership}
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
  joinCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  joinCodeContent: {
    flex: 1,
  },
  joinCodeLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  joinCodeValue: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  copyButton: {
    padding: theme.spacing.sm,
  },
}));
