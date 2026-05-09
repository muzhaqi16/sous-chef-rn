import React from 'react';
import {
  View,
  ActivityIndicator,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { SousChefLoader } from './SousChefLoader';
import { Text } from '#components/atoms/Text';

// Theme-reactive ActivityIndicator. When the consumer passes a `color`
// override (e.g. for branded backgrounds) we render the plain RN component
// so the override is preserved verbatim.
const ThemedActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.primary,
}));

export interface LoadingProps {
  /** Primary loading message */
  message?: string;

  /** Secondary message or additional info (e.g., barcode) */
  submessage?: string;

  /** Size of the activity indicator */
  size?: 'small' | 'large';

  /** Loading variant - inline: shows in-place, overlay: shows in modal, fullscreen: fills screen */
  variant?: 'inline' | 'overlay' | 'fullscreen';

  /** Whether the overlay/modal is visible (only for overlay/fullscreen variants) */
  visible?: boolean;

  /** Overlay transparency level */
  overlayOpacity?: 'light' | 'medium' | 'dark' | 'heavy';

  /** Whether the loading can be cancelled (only for overlay/fullscreen) */
  cancelable?: boolean;

  /** Callback when cancel is requested */
  onCancel?: () => void;

  /** Custom color for the spinner */
  color?: string;

  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
}

export const Loading: React.FC<LoadingProps> = ({
  message,
  submessage,
  size = 'large',
  variant = 'inline',
  visible = true,
  overlayOpacity = 'dark',
  cancelable = false,
  onCancel,
  color,
  style,
}) => {
  styles.useVariants({ inline: variant === 'inline', overlayOpacity });

  // Don't render if not visible (for overlay/fullscreen variants)
  if ((variant === 'overlay' || variant === 'fullscreen') && !visible) {
    return null;
  }

  const spinner =
    color != null ? (
      <ActivityIndicator size={size} color={color} style={styles.spinner} />
    ) : (
      <ThemedActivityIndicator size={size} style={styles.spinner} />
    );

  const renderContent = () => (
    <View style={[styles.container, style]}>
      {spinner}
      {!!message && (
        <Text
          size="md"
          weight="medium"
          align="center"
          tone="primary"
          style={styles.message}
        >
          {message}
        </Text>
      )}
      {!!submessage && (
        <Text
          size="sm"
          align="center"
          tone="secondary"
          style={styles.submessage}
        >
          {submessage}
        </Text>
      )}
    </View>
  );

  // Inline variant - just render the content directly
  if (variant === 'inline') {
    return renderContent();
  }

  // Fullscreen variant - fills the entire screen with branded loader
  if (variant === 'fullscreen') {
    return (
      <View style={styles.fullscreenContainer}>
        <SousChefLoader
          size="small"
          showBrand={false}
          message={message || 'Loading'}
        />
        {!!submessage && (
          <Text
            size="sm"
            align="center"
            tone="secondary"
            style={styles.submessage}
          >
            {submessage}
          </Text>
        )}
      </View>
    );
  }

  // Overlay variant - renders in a modal with backdrop
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (cancelable && onCancel) {
          onCancel();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {spinner}
          {!!message && (
            <Text
              size="md"
              weight="medium"
              align="center"
              tone="primary"
              style={styles.message}
            >
              {message}
            </Text>
          )}
          {!!submessage && (
            <Text
              size="sm"
              align="center"
              tone="secondary"
              style={styles.submessage}
            >
              {submessage}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Convenience exports for common loading patterns
export const LoadingInline: React.FC<
  Pick<LoadingProps, 'message' | 'submessage' | 'size'>
> = props => <Loading variant="inline" {...props} />;

export const LoadingOverlay: React.FC<
  Pick<
    LoadingProps,
    'visible' | 'message' | 'overlayOpacity' | 'cancelable' | 'onCancel'
  >
> = props => <Loading variant="overlay" size="large" {...props} />;

export const LoadingFullscreen: React.FC<
  Pick<LoadingProps, 'message' | 'submessage'>
> = props => <Loading variant="fullscreen" size="large" {...props} />;

const styles = StyleSheet.create(theme => ({
  // Inline variant styles
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    variants: {
      inline: {
        true: { flex: 1 },
        false: {},
      },
    },
  },

  // Fullscreen variant styles
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },

  // Overlay variant styles
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      overlayOpacity: {
        light: { backgroundColor: theme.colors.overlays.light },
        medium: { backgroundColor: theme.colors.overlays.medium },
        dark: { backgroundColor: theme.colors.overlays.dark },
        heavy: { backgroundColor: theme.colors.overlays.heavy },
      },
    },
  },

  card: {
    padding: theme.spacing['2xl'],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    minWidth: theme.sizes.modal.sm,
    backgroundColor: theme.colors.background,
    ...theme.shadows.md,
  },

  spinner: {
    marginBottom: theme.spacing.md,
  },

  message: {
    marginBottom: theme.spacing.xs,
  },

  submessage: {
    fontFamily: 'monospace',
  },
}));

export default Loading;
