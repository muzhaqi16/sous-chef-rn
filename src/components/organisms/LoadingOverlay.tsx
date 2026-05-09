import React from 'react';
import { View, ActivityIndicator, Modal } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.primary,
}));

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
  cancelable?: boolean;
  onCancel?: () => void;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  transparent = false,
  cancelable = false,
  onCancel,
}) => {
  styles.useVariants({ transparent });

  if (!visible) return null;

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
        <View style={styles.container}>
          <ThemedActivityIndicator size="large" style={styles.spinner} />
          {!!message && (
            <Text size="md" weight="medium" align="center">
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Specialized loading overlays for different contexts
export const AuthLoadingOverlay: React.FC<{ visible: boolean }> = ({
  visible,
}) => (
  <LoadingOverlay
    visible={visible}
    message="Authenticating..."
    transparent={false}
  />
);

export const NavigationLoadingOverlay: React.FC<{ visible: boolean }> = ({
  visible,
}) => (
  <LoadingOverlay visible={visible} message="Loading..." transparent={true} />
);

export const BiometricLoadingOverlay: React.FC<{ visible: boolean }> = ({
  visible,
}) => (
  <LoadingOverlay
    visible={visible}
    message="Waiting for authentication..."
    transparent={false}
  />
);

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      transparent: {
        true: { backgroundColor: theme.colors.overlays.light },
        false: { backgroundColor: theme.colors.overlays.medium },
      },
    },
  },
  container: {
    padding: theme.spacing.xl + 8,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    minWidth: 150,
    backgroundColor: theme.colors.background,
    ...theme.shadows.lg,
  },
  spinner: {
    marginBottom: theme.spacing.md,
  },
}));
