import React from 'react';
import { useTranslation } from '#/i18n';
import { View, Modal } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

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
}) => {
  const { t } = useTranslation();
  return (
    <LoadingOverlay
      visible={visible}
      message={t('labels.authenticating')}
      transparent={false}
    />
  );
};

export const NavigationLoadingOverlay: React.FC<{ visible: boolean }> = ({
  visible,
}) => {
  const { t } = useTranslation();
  return (
    <LoadingOverlay
      visible={visible}
      message={t('loadingOverlay.loading')}
      transparent={true}
    />
  );
};

export const BiometricLoadingOverlay: React.FC<{ visible: boolean }> = ({
  visible,
}) => {
  const { t } = useTranslation();
  return (
    <LoadingOverlay
      visible={visible}
      message={t('labels.waitingForAuthentication')}
      transparent={false}
    />
  );
};

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
    borderCurve: 'continuous',
    alignItems: 'center',
    minWidth: 150,
    backgroundColor: theme.colors.background,
    ...theme.shadows.lg,
  },
  spinner: {
    marginBottom: theme.spacing.md,
  },
}));
