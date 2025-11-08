import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { IconLibrary } from '#utils/iconUtils';

export interface FeatureHintConfig {
  /** Title of the hint */
  title: string;
  /** Subtitle/description text */
  subtitle?: string;
  /** Icon to display */
  icon?: {
    name: string;
    library: IconLibrary;
    size?: number;
  };
  /** Custom animated element (overrides icon) */
  animatedElement?: React.ReactNode;
  /** Dismiss button text */
  dismissText?: string;
  /** Callback when dismissed */
  onDismiss: () => void;
}

interface FeatureHintOverlayProps {
  config: FeatureHintConfig;
}

export const FeatureHintOverlay: React.FC<FeatureHintOverlayProps> = ({
  config,
}) => {
  const { theme } = useUnistyles();
  const {
    title,
    subtitle,
    icon,
    animatedElement,
    dismissText = 'Got it!',
    onDismiss,
  } = config;

  return (
    <Animated.View
      style={styles.overlay}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={styles.hintContainer}>
          <View style={styles.hintContent}>
            {/* Custom animated element or default icon */}
            {animatedElement ? (
              animatedElement
            ) : icon ? (
              <View style={styles.iconContainer}>
                <Icon
                  name={icon.name}
                  size={icon.size || 32}
                  color={theme.colors.primary}
                  library={icon.library}
                />
              </View>
            ) : null}

            <Text style={styles.hintTitle}>{title}</Text>
            {subtitle && <Text style={styles.hintSubtitle}>{subtitle}</Text>}
          </View>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>{dismissText}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    marginHorizontal: theme.spacing.xl,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  hintContent: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconContainer: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: (theme.colors as any).primaryLight || theme.colors.primary + '20',
    borderRadius: theme.radii.full,
  },
  hintTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  hintSubtitle: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  dismissButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    minWidth: 120,
  },
  dismissButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
    textAlign: 'center',
  },
}));
