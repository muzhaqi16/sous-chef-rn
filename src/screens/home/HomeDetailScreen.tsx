import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { StaticScreenProps } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useHomeDetailManagement,
  ROLE_OPTIONS,
} from '#hooks/home/useHomeDetailManagement';

import { DetailTemplate } from '#components/templates/DetailTemplate';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { EditableField } from '#components/molecules/EditableField';
import { NavigationRow } from '#components/molecules/NavigationRow';
import { HomeMembersSection } from '#components/organisms/home/HomeMembersSection';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { useUser } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/base/Button';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeRefreshWithFinally } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';

type RouteParams = {
  homeId: string;
};

export const HomeDetailScreen: React.FC<StaticScreenProps<RouteParams>> = ({
  route,
}) => {
  useScreenTransition('HomeDetailScreen');
  const { goBack, navigate } = useAppNavigation();
  const { homeId } = route.params;
  // PERFORMANCE: Use selective selector instead of full store subscription
  const currentUser = useUser();
  const { theme } = useUnistyles();

  const [copied, setCopied] = useState(false);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const {
    home,
    loading,
    error,
    leaving,
    refetch,
    rolePickerState,
    handleRoleSelect,
    closeRolePicker,
    saveName,
    changeRole,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
  } = useHomeDetailManagement(homeId);

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

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

  const handleToggleJoinCode = (enabled: boolean) => {
    executeRefreshWithFinally(
      () => toggleJoinCode(enabled),
      setJoinCodeLoading,
    );
  };

  // Use myMembership for reliable current user membership (not affected by connection limits)
  const currentUserMembership = home?.myMembership;

  const isOwner = currentUserMembership?.role === 'OWNER';
  const canManage = currentUserMembership?.canManageHome ?? false;

  const handleLeaveHome = async () => {
    if (!home) return;

    // Check if user is owner
    if (isOwner) {
      alertService.alert(
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
    const getMessage = () => {
      if (loading) return 'Loading';
      if (error) return 'Failed to load home details';
      return 'Home not found';
    };

    return (
      <DetailTemplate
        title="Home Details"
        onBack={goBack}
        headerActions={[]}
        sections={[
          {
            content: (
              <View style={styles.loadingContainer}>
                <SousChefLoader
                  size="small"
                  showBrand={false}
                  message={getMessage()}
                />
                {!loading && !!error && (
                  <Button
                    title="Retry"
                    onPress={() => refetch()}
                    variant="secondary"
                    style={styles.retryButton}
                  />
                )}
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
            readOnly={!canManage}
            validation={value => {
              if (!value.trim()) {
                return 'Home name cannot be empty';
              }
              return null;
            }}
          />
          {canManage ? (
            <SettingSwitch
              title="Allow Join Code"
              description="Let others join this home using a code"
              value={home.allowJoinCode ?? false}
              onValueChange={handleToggleJoinCode}
              disabled={joinCodeLoading}
              loading={joinCodeLoading}
              containerStyle={styles.joinCodeSwitch}
            />
          ) : null}
          {canManage && !!home.allowJoinCode && !!home.joinCode ? (
            <View style={styles.joinCodeRow}>
              <View style={styles.joinCodeContent}>
                <Text size="sm" tone="secondary" style={styles.joinCodeLabel}>
                  Join Code
                </Text>
                <Text size="lg" weight="semibold" style={styles.joinCodeValue}>
                  {home.joinCode}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleCopyJoinCode}
              >
                <Icon
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  tone={copied ? 'success' : 'textPrimary'}
                />
              </Pressable>
            </View>
          ) : null}
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
      title: 'Storage',
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
                <Text
                  size="sm"
                  tone="secondary"
                  style={styles.leaveHomeDescription}
                >
                  Leaving this home will remove your access to all shared
                  pantries, shopping lists, meal plans, and templates.
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
    <>
      <DetailTemplate
        title="Home Details"
        onBack={goBack}
        headerActions={[]}
        sections={sections}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <ModalPicker
        visible={rolePickerState.visible}
        label="Select Role"
        options={ROLE_OPTIONS}
        selected={rolePickerState.currentRole}
        onSelect={handleRoleSelect}
        onCancel={closeRolePicker}
        confirmLabel="Save"
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  retryButton: {
    marginTop: theme.spacing.md,
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
    marginBottom: theme.spacing.xs,
  },
  joinCodeValue: {
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
    lineHeight: theme.fonts.size.sm * 1.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
