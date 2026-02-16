import React from 'react';
import {View, Pressable, Text, Modal} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils/iconUtils';

export const RememberMeModal: React.FC<{
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  email: string;
}> = ({visible, onAccept, onDecline, email}) => {
  const {theme} = useUnistyles();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDecline}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Icon name="lock" size={48} color={theme.colors.primary} />

          <Text style={styles.modalTitle}>Remember login info?</Text>
          <Text style={styles.modalSubtitle}>
            We'll securely save your login info for {email} on this device, so
            you won't need to enter it next time.
          </Text>

          <View style={styles.modalButtons}>
            <Pressable
              style={({pressed}) => [styles.modalButton, styles.modalButtonSecondary, pressed && styles.pressed]}
              onPress={onDecline}>
              <Text style={styles.modalButtonSecondaryText}>Not Now</Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [styles.modalButton, styles.modalButtonPrimary, pressed && styles.pressed]}
              onPress={onAccept}>
              <Text style={styles.modalButtonPrimaryText}>Remember</Text>
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
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.lineHeight.normal,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: theme.spacing['3'],
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonPrimaryText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
}));