import React from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
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
        <View style={styles.modalContent}>
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
            <Pressable
              style={({ pressed }) => [
                styles.modalButtonSecondary,
                pressed && styles.pressed,
              ]}
              onPress={onDecline}
            >
              <Text size="md" weight="semibold">
                {t('rememberMe.notNow')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalButtonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={onAccept}
            >
              <Text
                size="md"
                weight="semibold"
                style={styles.modalButtonPrimaryText}
              >
                {t('rememberMe.remember')}
              </Text>
            </Pressable>
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
    gap: theme.spacing['3'],
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonPrimaryText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
