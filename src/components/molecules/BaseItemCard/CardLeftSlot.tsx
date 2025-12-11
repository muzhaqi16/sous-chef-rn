import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { commonStyles } from '#/styles';
import type { CardLeftSlotProps } from './types';

/**
 * Left slot component for BaseItemCard
 * Renders emoji, image, icon, or custom content
 */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = ({
  type,
  emoji,
  imageUrl,
  icon,
  iconLibrary = 'MaterialIcons',
  backgroundColor,
  variant = 'normal',
  dimmed = false,
  children,
}) => {
  const { theme } = useUnistyles();

  const getBackgroundColor = (): string => {
    if (backgroundColor) return backgroundColor;

    switch (variant) {
      case 'warning':
        return theme.colors.warning + '20';
      case 'expired':
        return theme.colors.expiration.expiredIconBg;
      default:
        return theme.colors.surfaceVariant;
    }
  };

  if (type === 'custom' && children) {
    return (
      <View style={[styles.container, dimmed && styles.dimmed]}>
        {children}
      </View>
    );
  }

  if (type === 'image' && imageUrl) {
    return (
      <View
        style={[
          commonStyles.listItemImageContainer,
          styles.imageContainer,
          { backgroundColor: theme.colors.surface },
          dimmed && styles.dimmed,
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={[commonStyles.listItemImage, { resizeMode: 'cover' }]}
        />
      </View>
    );
  }

  if (type === 'icon' && icon) {
    return (
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getBackgroundColor() },
          dimmed && styles.dimmed,
        ]}
      >
        <Icon
          name={icon}
          size={theme.sizes.icon.md}
          color={theme.colors.textPrimary}
          library={iconLibrary}
        />
      </View>
    );
  }

  // Default to emoji
  return (
    <View
      style={[
        styles.emojiContainer,
        { backgroundColor: getBackgroundColor() },
        dimmed && styles.dimmed,
      ]}
    >
      <Text style={styles.emoji}>{emoji || '📦'}</Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {},
  imageContainer: {
    overflow: 'hidden',
  },
  iconContainer: {
    width: theme.sizes.avatar.md,
    height: theme.sizes.avatar.md,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
  },
  emojiContainer: {
    width: theme.sizes.avatar.md,
    height: theme.sizes.avatar.md,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
  },
  emoji: {
    fontSize: theme.typography.fontSize.xl,
  },
  dimmed: {
    opacity: 0.5,
  },
}));
