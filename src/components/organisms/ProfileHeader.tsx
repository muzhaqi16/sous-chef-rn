import React from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {IconButton} from '../atoms/IconButton';
import {Icon} from '#/utils';

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
  name,
  subtitle,
  onBack,
  onMore,
  onAvatarPress,
}) => {
  const {theme} = useUnistyles();
  return (
    <View style={styles.header}>
      <IconButton
        name="arrow-left"
        onPress={onBack}
        color={theme.colors.textPrimary}
      />
      <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image
            source={{uri: avatarUrl}}
            style={styles.avatar}
            resizeMode="cover"
            onError={() =>
              console.log('Avatar image failed to load:', avatarUrl)
            }
            onLoad={() => console.log('Avatar image loaded successfully')}
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
          <Icon library="Feather" color="#fff" name="edit-3" size={15} />
        </View>
      </TouchableOpacity>
      <IconButton
        name="more-vertical"
        library="Feather"
        onPress={onMore}
        color={theme.colors.textPrimary}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  avatarContainer: {},
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.sizes.avatar,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
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
    borderRadius: 9999,
    backgroundColor: theme.colors.primary,
  },
}));
