import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils';
import { IconButton } from '#components/atoms/IconButton';
import { useDeleteAccountMutation } from '#generated';
import { useAuth, useAppNavigation } from '#hooks';

export const DeleteAccountScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const { logout } = useAuth();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteAccountMutation] = useDeleteAccountMutation({
    onCompleted: () => logout(),
    onError: error => {
      Alert.alert('Error', `Failed to delete account: ${error.message}`);
      setIsDeleting(false);
    },
  });

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm');
      return;
    }

    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure? This action cannot be undone and all your data will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccountMutation();
            } catch (error) {
              console.error('Delete account error:', error);
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          onPress={goBack}
          color={theme.colors.textPrimary}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <View style={styles.warningContainer}>
          <Icon
            library="Feather"
            name="alert-triangle"
            size={48}
            color={theme.colors.error}
          />
          <Text style={styles.warningTitle}>Warning: This is permanent!</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What will be deleted:</Text>
          <View style={styles.bulletPoint}>
            <Icon
              library="Feather"
              name="x-circle"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>
              Your profile and account information
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              library="Feather"
              name="x-circle"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>
              All your pantry items and inventory
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              library="Feather"
              name="x-circle"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>Your shopping lists</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              library="Feather"
              name="x-circle"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>
              All associated data and preferences
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before you proceed:</Text>
          <Text style={styles.text}>
            • This action is <Text style={styles.bold}>irreversible</Text>
          </Text>
          <Text style={styles.text}>• You will be immediately logged out</Text>
          <Text style={styles.text}>
            • You cannot recover your account or data after deletion
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationLabel}>
            Type <Text style={styles.bold}>DELETE</Text> to confirm:
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type DELETE"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isDeleting}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            (confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting) &&
              styles.deleteButtonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
        >
          <Text style={styles.deleteButtonText}>
            {isDeleting ? 'Deleting Account...' : 'Delete My Account Forever'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={goBack}
          disabled={isDeleting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  warningContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: `${theme.colors.error}10`,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  warningTitle: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.error,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bulletText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  text: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    lineHeight: theme.fonts.size.sm * 1.5,
  },
  bold: {
    fontWeight: theme.fonts.weight.bold,
  },
  confirmationSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  confirmationLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  deleteButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  deleteButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  cancelButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
  },
}));
