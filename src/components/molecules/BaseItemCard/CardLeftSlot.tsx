import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { CachedImage } from '#components/atoms/CachedImage';
import type { CardLeftSlotProps } from './types';
import { Text } from '#components/atoms/Text';

/**
 * Lightweight image slot — no useUnistyles, all styles from stylesheet
 */
const ImageSlot: React.FC<{ imageUrl: string; dimmed: boolean }> = ({
  imageUrl,
  dimmed,
}) => {
  styles.useVariants({ dimmed });
  return (
    <View
      style={[
        commonStyles.listItemImageContainerCompact,
        styles.imageContainer,
      ]}
    >
      <CachedImage
        uri={imageUrl}
        style={commonStyles.listItemImageCompact}
        displaySize={48}
      />
    </View>
  );
};

/**
 * Themed slot — backgroundColor driven via variants, icon via local Icon tone
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
  styles.useVariants({ variant, dimmed });

  if (type === 'custom' && children) {
    return <View style={styles.container}>{children}</View>;
  }

  if (type === 'icon' && icon) {
    return (
      <View
        style={[
          styles.slotContainer,
          backgroundColor ? { backgroundColor } : undefined,
        ]}
      >
        <Icon name={icon} size={24} tone="textPrimary" library={iconLibrary} />
      </View>
    );
  }

  // Default to emoji
  return (
    <View
      style={[
        styles.slotContainer,
        backgroundColor ? { backgroundColor } : undefined,
      ]}
    >
      <Text size="xl">{emoji || '📦'}</Text>
    </View>
  );
};

/**
 * Left slot component for BaseItemCard
 * Renders emoji, image, icon, or custom content
 */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = props => {
  // Image path is lightweight — no useUnistyles needed
  if (props.type === 'image' && props.imageUrl) {
    return (
      <ImageSlot imageUrl={props.imageUrl} dimmed={props.dimmed ?? false} />
    );
  }

  // All other types need theme access
  return <ThemedSlot {...props} />;
};

const styles = StyleSheet.create(theme => ({
  container: {
    variants: {
      dimmed: {
        true: { opacity: 0.5 },
      },
    },
  },
  imageContainer: {
    overflow: 'hidden',
    variants: {
      dimmed: {
        true: { opacity: 0.5 },
      },
    },
  },
  slotContainer: {
    width: theme.sizes.avatar.md,
    height: theme.sizes.avatar.md,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['3'],
    backgroundColor: theme.colors.surfaceVariant,
    variants: {
      variant: {
        warning: { backgroundColor: theme.colors.warning + '20' },
        expired: { backgroundColor: theme.colors.expiration.expiredIconBg },
        normal: { backgroundColor: theme.colors.surfaceVariant },
        success: { backgroundColor: theme.colors.surfaceVariant },
        dimmed: { backgroundColor: theme.colors.surfaceVariant },
      },
      dimmed: {
        true: { opacity: 0.5 },
      },
    },
  },
}));
