import React from 'react';
import {
  View,
  ActivityIndicator,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SousChefLoader } from './SousChefLoader';
import { Text } from '#components/atoms/Text';

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
  const { theme } = useUnistyles();

  // Don't render if not visible (for overlay/fullscreen variants)
  if ((variant === 'overlay' || variant === 'fullscreen') && !visible) {
    return null;
  }

  const spinnerColor = color || theme.colors.primary;

  const renderContent = () => (
    <View
      style={[
        styles.container,
        variant === 'inline' && styles.containerInline,
        style,
      ]}
    >
      <ActivityIndicator
        size={size}
        color={spinnerColor}
        style={styles.spinner}
      />
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
  const overlayColors = {
    light: theme.colors.overlays.light,
    medium: theme.colors.overlays.medium,
    dark: theme.colors.overlays.dark,
    heavy: theme.colors.overlays.heavy,
  };

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
      <View
        style={[
          styles.overlay,
          { backgroundColor: overlayColors[overlayOpacity] },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.background,
              ...theme.shadows.md,
            },
          ]}
        >
          <ActivityIndicator
            size={size}
            color={spinnerColor}
            style={styles.spinner}
          />
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
  },

  containerInline: {
    flex: 1,
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
  },

  card: {
    padding: theme.spacing['2xl'],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    minWidth: theme.sizes.modal.sm,
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
