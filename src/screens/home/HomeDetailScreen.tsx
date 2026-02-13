import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useHomeDetailManagement } from '#hooks/home/useHomeDetailManagement';
import { commonStyles } from '#/styles/commonStyles';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { EditableField } from '#components/molecules/EditableField';
import { NavigationRow } from '#components/molecules/NavigationRow';
import { HomeMembersSection } from '#components/organisms/home/HomeMembersSection';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { useAppStore, selectUser } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/base/Button';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<{
  route: { params: RouteParams };
}> = ({ route }) => {
  useScreenTransition('HomeDetailScreen');
  const { goBack, navigate } = useAppNavigation();
  const { homeId } = route.params;
  // PERFORMANCE: Use selective selector instead of full store subscription
  const currentUser = useAppStore(selectUser);
  const { theme } = useUnistyles();

  const [copied, setCopied] = useState(false);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);

  const {
    home,
    loading,
    leaving,
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
  } = useHomeDetailManagement(homeId);

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

  const handleToggleJoinCode = async (enabled: boolean) => {
    setJoinCodeLoading(true);
    try {
      await toggleJoinCode(enabled);
    } finally {
      setJoinCodeLoading(false);
    }
  };

  // Find current user's membership to check permissions
  const currentUserMembership = home?.members?.find(
    member => member.userId === currentUser?.id,
  );

  const isOwner = currentUserMembership?.role === 'OWNER';

  const handleLeaveHome = async () => {
    if (!home) return;

    // Check if user is owner
    if (isOwner) {
      Alert.alert(
        'Cannot Leave',
        'Owners cannot leave the home. Please transfer ownership to another member or delete the home.',
        [{ text: 'OK' }],
      );
      return;
    }

    const success = await leaveHome(home.name);
    if (success) {
      goBack();
    }
  };

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
          <SettingSwitch
            title="Allow Join Code"
            description="Let others join this home using a code"
            value={home.allowJoinCode ?? false}
            onValueChange={handleToggleJoinCode}
            disabled={joinCodeLoading}
            loading={joinCodeLoading}
            containerStyle={styles.joinCodeSwitch}
          />
          {home.allowJoinCode && home.joinCode && (
            <View style={styles.joinCodeRow}>
              <View style={styles.joinCodeContent}>
                <Text style={styles.joinCodeLabel}>Join Code</Text>
                <Text style={styles.joinCodeValue}>{home.joinCode}</Text>
              </View>
              <Pressable
                style={({pressed}) => [styles.copyButton, pressed && styles.pressed]}
                onPress={handleCopyJoinCode}
              >
                <Icon
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  color={
                    copied ? theme.colors.success : theme.colors.textPrimary
                  }
                  library="Ionicons"
                />
              </Pressable>
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
    // Only show Leave Home section for non-owners
    ...(!isOwner
      ? [
          {
            title: 'Danger Zone',
            content: (
              <View style={styles.leaveHomeSection}>
                <Text style={styles.leaveHomeDescription}>
                  Leaving this home will remove your access to all shared
                  pantries and shopping lists.
                </Text>
                <Button
                  title="Leave Home"
                  onPress={handleLeaveHome}
                  variant="danger"
                  loading={leaving}
                  disabled={leaving}
                />
              </View>
            ),
          },
        ]
      : []),
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
  joinCodeSwitch: {
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  leaveHomeSection: {
    gap: theme.spacing.md,
  },
  leaveHomeDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.fonts.size.sm * 1.5,
  },
  pressed: {
    opacity: 0.7,
  },
}));
