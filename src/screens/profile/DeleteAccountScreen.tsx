import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils';
import { IconButton } from '#components/atoms/IconButton';
import {
  useDeleteAccountMutation,
  useCanDeleteAccountQuery,
} from '#generated';
import { useAuth, useAppNavigation } from '#hooks';

export const DeleteAccountScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const { logout } = useAuth();

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

  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Checking account status...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Icon
        library="Feather"
        name="alert-circle"
        size={48}
        color={theme.colors.error}
      />
      <Text style={styles.errorTitle}>Unable to check account status</Text>
      <Text style={styles.errorText}>
        {eligibilityError?.message || 'An error occurred. Please try again.'}
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => refetchEligibility()}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBlockedState = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.blockedWarningContainer}>
        <Icon
          library="Feather"
          name="alert-circle"
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
            <Icon
              library="Feather"
              name="home"
              size={20}
              color={theme.colors.primary}
            />
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

      <TouchableOpacity style={styles.goBackButton} onPress={goBack}>
        <Text style={styles.goBackButtonText}>Go Back</Text>
      </TouchableOpacity>
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

      {renderContent()}
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
  // Loading state styles
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
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
