import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { IconButton } from '../atoms/IconButton';
import { Icon } from '#/utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';

export interface ProfileHeaderProps {
  avatarUrl?: string | null;
  name: string;
  subtitle?: string;
  onBack: () => void;
  onMore: () => void;
  onAvatarPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  avatarUrl,
  onBack,
  onMore,
  onAvatarPress,
}) => {
  const { theme } = useUnistyles();
  return (
    <View style={styles.header}>
      <IconButton
        name="arrow-left"
        onPress={onBack}
        color={theme.colors.textPrimary}
        accessibilityLabel="Go back"
      />
      <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
        {avatarUrl ? (
          <CachedImage
            uri={avatarUrl}
            style={styles.avatar}
            onFailure={() =>
              console.log('Avatar image failed to load:', avatarUrl)
            }
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Icon
              library="Feather"
              name="user"
              size={32}
              color={theme.colors.textSecondary}
            />
          </View>
        )}
        <View style={styles.profileAction}>
          <Icon
            library="Feather"
            color={theme.colors.iconOnPrimary}
            name="edit-3"
            size={15}
          />
        </View>
      </TouchableOpacity>
      <IconButton
        name="more-vertical"
        library="Feather"
        onPress={onMore}
        color={theme.colors.textPrimary}
        accessibilityLabel="More options"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  avatarContainer: {},
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.sizes.avatar.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAction: {
    position: 'absolute',
    right: -4,
    bottom: -10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
}));
