import React from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export const RememberMeModal: React.FC<{
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  email: string;
}> = ({ visible, onAccept, onDecline, email }) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent} testID="remember-me-modal">
          <Icon name="lock-closed-outline" size={48} tone="primary" />

          <Text size="xl" weight="semibold" style={styles.modalTitle}>
            {t('rememberMe.title')}
          </Text>
          <Text
            size="sm"
            tone="secondary"
            align="center"
            lineHeight="normal"
            style={styles.modalSubtitle}
          >
            {t('rememberMe.body', { email })}
          </Text>

          <View style={styles.modalButtons}>
            <AppPressable
              style={styles.modalButtonSecondary}
              onPress={onDecline}
              testID="remember-me-decline"
            >
              <Text size="md" weight="semibold">
                {t('rememberMe.notNow')}
              </Text>
            </AppPressable>

            <AppPressable
              style={styles.modalButtonPrimary}
              onPress={onAccept}
              testID="remember-me-accept"
            >
              <Text
                size="md"
                weight="semibold"
                style={styles.modalButtonPrimaryText}
              >
                {t('rememberMe.remember')}
              </Text>
            </AppPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    marginBottom: theme.spacing.sm,
  },
  modalSubtitle: {
    marginBottom: theme.spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing.base,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  modalButtonPrimaryText: {
    color: theme.colors.onPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
