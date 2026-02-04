import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

interface ShoppingListHeaderProps {
  listName: string;
  avatarUrl?: string | null;
  notificationCount?: number;
  onAvatarPress?: () => void;
}

export const ShoppingListHeader: React.FC<ShoppingListHeaderProps> = ({
  listName,
  avatarUrl,
  notificationCount = 0,
  onAvatarPress,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        <Text style={styles.label}>Shopping list</Text>
        <Text style={styles.listName} numberOfLines={1} ellipsizeMode="tail">
          {listName}
        </Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity onPress={onAvatarPress}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image
                alt=""
                source={{ uri: avatarUrl }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon
                  library="Ionicons"
                  name="person"
                  size={24}
                  color={styles.avatarIcon.color}
                />
              </View>
            )}

            {notificationCount > 0 && (
              <View style={styles.avatarNotification} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  leftContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  listName: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatar: {
    position: 'relative',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl - 2,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    color: theme.colors.textSecondary,
  },
  avatarNotification: {
    position: 'absolute',
    borderRadius: theme.radii.full,
    borderWidth: 2,
    borderColor: theme.colors.white,
    top: 0,
    right: -2,
    width: 14,
    height: 14,
    backgroundColor: theme.colors.error,
  },
}));
