import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { LoadingInline } from '#components/base/Loading';
import { useDeleteAccountMutation, useCanDeleteAccountQuery } from '#generated';
import { authService } from '#/services/authService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';

/** Module-level wrapper around the deleteAccount mutation. Extracted from the
 *  inline `onPress` arrow inside the component body so the surrounding try/catch
 *  does not bail out the React Compiler. */
async function performDeleteAccount(
  deleteAccountMutation: () => Promise<unknown>,
  setIsDeleting: (v: boolean) => void,
): Promise<void> {
  setIsDeleting(true);
  const result = await executeMutation(
    () => deleteAccountMutation(),
    error => {
      errorService.reportError(error, {
        operation: 'DeleteAccount.deleteAccount',
      });
      setIsDeleting(false);
    },
  );
  if (result === false) {
    // executeMutation already invoked the error callback above; nothing else to do
  }
}

export const DeleteAccountScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if account can be deleted
  const {
    data: eligibilityData,
    loading: checkingEligibility,
    error: eligibilityError,
    refetch: refetchEligibility,
  } = useCanDeleteAccountQuery({
    fetchPolicy: 'network-only',
  });

  const canDelete = eligibilityData?.canDeleteAccount?.canDelete ?? false;
  const blockers = eligibilityData?.canDeleteAccount?.blockers ?? [];

  const [deleteAccountMutation] = useDeleteAccountMutation({
    onCompleted: () => authService.logout(),
    onError: error => {
      alertService.alert('Error', `Failed to delete account: ${error.message}`);
      setIsDeleting(false);
    },
  });

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      alertService.alert('Error', 'Please type DELETE to confirm');
      return;
    }

    alertService.alert(
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
          onPress: () =>
            performDeleteAccount(deleteAccountMutation, setIsDeleting),
        },
      ],
    );
  };

  const renderLoadingState = () => (
    <LoadingInline message="Checking account status..." />
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Icon name="alert-circle-outline" size={48} color={theme.colors.error} />
      <Text style={styles.errorTitle}>Unable to check account status</Text>
      <Text style={styles.errorText}>
        {eligibilityError?.message || 'An error occurred. Please try again.'}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        onPress={() => refetchEligibility()}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );

  const renderBlockedState = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.blockedWarningContainer}>
        <Icon
          name="alert-circle-outline"
          size={48}
          color={theme.colors.warning}
        />
        <Text style={styles.blockedWarningTitle}>Cannot Delete Account</Text>
      </View>

      <Text style={styles.blockedDescription}>
        Your account cannot be deleted until you resolve the following:
      </Text>

      {blockers.map((blocker, index) => (
        <View key={blocker.resourceId || index} style={styles.blockerCard}>
          <View style={styles.blockerHeader}>
            <Icon name="home-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.blockerResourceName}>
              {blocker.resourceName}
            </Text>
          </View>
          <Text style={styles.blockerMessage}>{blocker.message}</Text>
          <View style={styles.resolutionSection}>
            <Text style={styles.resolutionTitle}>To resolve:</Text>
            <Text style={styles.resolutionOption}>
              • Transfer ownership to another member
            </Text>
            <Text style={styles.resolutionOption}>
              • Remove all members from the home
            </Text>
            <Text style={styles.resolutionOption}>• Delete the home</Text>
          </View>
        </View>
      ))}

      <Pressable
        style={({ pressed }) => [
          styles.goBackButton,
          pressed && styles.pressed,
        ]}
        onPress={goBack}
      >
        <Text style={styles.goBackButtonText}>Go Back</Text>
      </Pressable>
    </ScrollView>
  );

  const renderDeleteForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warningContainer}>
          <Icon name="warning-outline" size={48} color={theme.colors.error} />
          <Text style={styles.warningTitle}>Warning: This is permanent!</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What will be deleted:</Text>
          <View style={styles.bulletPoint}>
            <Icon
              name="close-circle-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>
              Your profile and account information
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              name="close-circle-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>
              All your pantry items and inventory
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              name="close-circle-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.bulletText}>Your shopping lists</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon
              name="close-circle-outline"
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
          <BaseInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type DELETE"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isDeleting}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            (confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting) &&
              styles.deleteButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleDeleteAccount}
          disabled={confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
        >
          <Text style={styles.deleteButtonText}>
            {isDeleting ? 'Deleting Account...' : 'Delete My Account Forever'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
          onPress={goBack}
          disabled={isDeleting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderContent = () => {
    if (checkingEligibility) {
      return renderLoadingState();
    }

    if (eligibilityError) {
      return renderErrorState();
    }

    if (!canDelete && blockers.length > 0) {
      return renderBlockedState();
    }

    return renderDeleteForm();
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Header title="Delete Account" onBack={goBack} centerTitle />

      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  // Error state styles
  errorTitle: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  // Blocked state styles
  blockedWarningContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: `${theme.colors.warning}15`,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
  },
  blockedWarningTitle: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.warning,
    marginTop: 12,
  },
  blockedDescription: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  blockerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  blockerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  blockerResourceName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.sm,
  },
  blockerMessage: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  resolutionSection: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  resolutionTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  resolutionOption: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    marginBottom: 4,
  },
  goBackButton: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  goBackButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  // Delete form styles (existing)
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
  deleteButton: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  deleteButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: theme.opacity.disabled,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default DeleteAccountScreen;
