import React from 'react';
import {View, TouchableOpacity, Text, Modal} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils';

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
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={onDecline}>
              <Text style={styles.modalButtonSecondaryText}>Not Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={onAccept}>
              <Text style={styles.modalButtonPrimaryText}>Remember</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
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
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
}));
