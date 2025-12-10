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
        return '#FEF3C7'; // amber-100
      case 'expired':
        return theme.colors.expiration.expiredIconBg;
      default:
        return '#F8FAFC'; // slate-50
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
          size={22}
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

const styles = StyleSheet.create(_theme => ({
  container: {},
  imageContainer: {
    overflow: 'hidden',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 22,
  },
  dimmed: {
    opacity: 0.5,
  },
}));
