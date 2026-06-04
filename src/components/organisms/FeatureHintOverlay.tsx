import React from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface FeatureHintConfig {
  /** Title of the hint */
  title: string;
  /** Subtitle/description text */
  subtitle?: string;
  /** Icon to display */
  icon?: {
    name: string;
    library?: string;
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
  const { t } = useTranslation();
  const { title, subtitle, icon, animatedElement, dismissText, onDismiss } =
    config;
  const resolvedDismissText = dismissText ?? t('featureHint.dismiss');

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={styles.overlay} testID="feature-hint-overlay">
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          testID="feature-hint-overlay-backdrop"
        >
          <Animated.View
            style={styles.hintContainer}
            exiting={FadeOut.duration(TIMING.STANDARD)}
          >
            <View style={styles.hintContent}>
              {/* Custom animated element or default icon */}
              {animatedElement ? (
                animatedElement
              ) : icon ? (
                <View style={styles.iconContainer}>
                  <Icon
                    name={icon.name}
                    size={icon.size || 32}
                    tone="primary"
                    library={icon.library}
                  />
                </View>
              ) : null}

              <Text
                size="lg"
                weight="bold"
                align="center"
                style={styles.hintTitle}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text size="md" tone="secondary" align="center">
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <AppPressable
              style={styles.dismissButton}
              onPress={onDismiss}
              testID="feature-hint-overlay-dismiss"
            >
              <Text
                size="md"
                weight="semibold"
                align="center"
                style={styles.dismissButtonText}
              >
                {resolvedDismissText}
              </Text>
            </AppPressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlays.heavy,
    justifyContent: 'center',
    alignItems: 'center',
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
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 8,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.3)',
      },
    ],
  },
  hintContent: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconContainer: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
  hintTitle: {
    marginBottom: theme.spacing.sm,
  },
  dismissButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    minWidth: 120,
  },
  dismissButtonText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
