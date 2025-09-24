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
      onRequestClose={() => {
        if (cancelable && onCancel) {
          onCancel();
        }
      }}
    >
      <View style={[
        styles.overlay,
        { backgroundColor: transparent ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)' }
      ]}>
        <View style={[
          styles.container,
          { backgroundColor: theme.colors.background }
        ]}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={styles.spinner}
          />
          {message && (
            <Text style={[
              styles.message,
              { color: theme.colors.textPrimary }
            ]}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Specialized loading overlays for different contexts
export const AuthLoadingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => (
  <LoadingOverlay
    visible={visible}
    message="Authenticating..."
    transparent={false}
  />
);

export const NavigationLoadingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => (
  <LoadingOverlay
    visible={visible}
    message="Loading..."
    transparent={true}
  />
);

export const BiometricLoadingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => (
  <LoadingOverlay
    visible={visible}
    message="Waiting for authentication..."
    transparent={false}
  />
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});