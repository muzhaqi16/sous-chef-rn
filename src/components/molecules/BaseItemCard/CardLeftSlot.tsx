import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { CachedImage } from '#components/atoms/CachedImage';
import type { CardLeftSlotProps } from './types';

/**
 * Lightweight image slot — no useUnistyles, all styles from stylesheet
 */
const ImageSlot: React.FC<{ imageUrl: string; dimmed: boolean }> = ({ imageUrl, dimmed }) => (
  <View
    style={[
      commonStyles.listItemImageContainerCompact,
      styles.imageContainer,
      dimmed && styles.dimmed,
    ]}
  >
    <CachedImage
      uri={imageUrl}
      style={commonStyles.listItemImageCompact}
      displaySize={48}
    />
  </View>
);

/**
 * Themed slot — needs useUnistyles for dynamic backgroundColor and icon colors
 */
const ThemedSlot: React.FC<CardLeftSlotProps> = ({
  type,
  emoji,
  icon,
  iconLibrary,
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

  if (type === 'icon' && icon) {
    return (
      <View
        style={[
          styles.slotContainer,
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
        styles.slotContainer,
        { backgroundColor: getBackgroundColor() },
        dimmed && styles.dimmed,
      ]}
    >
      <Text style={styles.emoji}>{emoji || '📦'}</Text>
    </View>
  );
};

/**
 * Left slot component for BaseItemCard
 * Renders emoji, image, icon, or custom content
 */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = (props) => {
  // Image path is lightweight — no useUnistyles needed
  if (props.type === 'image' && props.imageUrl) {
    return <ImageSlot imageUrl={props.imageUrl} dimmed={props.dimmed ?? false} />;
  }

  // All other types need theme access
  return <ThemedSlot {...props} />;
};

const styles = StyleSheet.create(theme => ({
  container: {},
  imageContainer: {
    overflow: 'hidden',
  },
  slotContainer: {
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
