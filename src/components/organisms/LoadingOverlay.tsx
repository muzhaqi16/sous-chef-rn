import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();

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
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: transparent
              ? theme.colors.overlays.light
              : theme.colors.overlays.medium,
          },
        ]}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={styles.spinner}
          />
          {!!message && (
            <Text style={[styles.message, { color: theme.colors.textPrimary }]}>
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
  },
  container: {
    padding: theme.spacing.xl + 8,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    minWidth: 150,
    ...theme.shadows.lg,
  },
  spinner: {
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    fontWeight: theme.fonts.weight.medium,
  },
}));
