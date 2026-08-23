import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#/utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { LoadingInline } from '#components/atoms/Loading';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  DeleteAccountDocument,
  CanDeleteAccountDocument,
  type DeleteAccountMutation,
} from '#operations/auth/user.generated';
import { authService } from '#/services/authService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';

/** Module-level wrapper around the deleteAccount mutation. Extracted from the
 *  inline `onPress` arrow inside the component body so the surrounding try/catch
 *  does not bail out the React Compiler. */
async function performDeleteAccount(
  deleteAccountMutation: () => Promise<{
    data?: DeleteAccountMutation | null;
    error?: unknown;
  }>,
  setIsDeleting: (v: boolean) => void,
  rejectionMessage: string,
): Promise<void> {
  setIsDeleting(true);
  let result;
  try {
    result = await deleteAccountMutation();
  } catch (error) {
    handleMutationError(error, { operation: 'Delete Account' });
    setIsDeleting(false);
  }
  if (!result) return; // transport error — already surfaced by the handler above

  // A ForbiddenError/ValidationError member resolves WITHOUT throwing under
  // errorPolicy:'all' — only the success payload logs the user out.
  if (alertIfRejected(result, rejectionMessage)) {
    setIsDeleting(false);
    return;
  }
  authService.logout();
}

export const DeleteAccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if account can be deleted
  const {
    data: eligibilityData,
    loading: checkingEligibility,
    error: eligibilityError,
    refetch: refetchEligibility,
  } = useQuery(CanDeleteAccountDocument, {
    fetchPolicy: 'network-only',
  });

  const canDelete = eligibilityData?.canDeleteAccount?.canDelete ?? false;
  const blockers = eligibilityData?.canDeleteAccount?.blockers ?? [];

  // Error/success handling lives in `performDeleteAccount` so a resolved error
  // member can't trigger logout — see the unwrapPayload note there.
  const [deleteAccountMutation] = useMutation(DeleteAccountDocument);

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      alertService.alert(
        t('labels.error'),
        t('account.deleteTypeConfirmError'),
      );
      return;
    }

    alertService.alert(
      t('account.deleteFinalConfirmTitle'),
      t('account.deleteFinalConfirmMessage'),
      [
        {
          text: t('labels.cancel'),
          style: 'cancel',
        },
        {
          text: t('account.deleteForeverButton'),
          style: 'destructive',
          onPress: () =>
            performDeleteAccount(
              deleteAccountMutation,
              setIsDeleting,
              t('account.deleteGenericError'),
            ),
        },
      ],
    );
  };

  const renderLoadingState = () => (
    <LoadingInline message={t('account.deleteCheckingStatus')} />
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Icon name="alert-circle-outline" size={48} tone="error" />
      <Text style={styles.errorTitle}>{t('account.deleteUnableToCheck')}</Text>
      <Text style={styles.errorText}>
        {eligibilityError?.message || t('account.deleteGenericError')}
      </Text>
      <AppPressable
        style={styles.retryButton}
        onPress={() => refetchEligibility()}
      >
        <Text style={styles.retryButtonText}>{t('labels.retry')}</Text>
      </AppPressable>
    </View>
  );

  const renderBlockedState = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.blockedWarningContainer}>
        <Icon name="alert-circle-outline" size={48} tone="warning" />
        <Text style={styles.blockedWarningTitle}>
          {t('account.deleteBlockedTitle')}
        </Text>
      </View>

      <Text style={styles.blockedDescription}>
        {t('account.deleteBlockedSubtitle')}
      </Text>

      {blockers.map((blocker, index) => (
        <View key={blocker.resourceId || index} style={styles.blockerCard}>
          <View style={styles.blockerHeader}>
            <Icon name="home-outline" size={20} tone="primary" />
            <Text style={styles.blockerResourceName}>
              {blocker.resourceName}
            </Text>
          </View>
          <Text style={styles.blockerMessage}>{blocker.message}</Text>
          <View style={styles.resolutionSection}>
            <Text style={styles.resolutionTitle}>
              {t('account.deleteResolveTitle')}
            </Text>
            <Text style={styles.resolutionOption}>
              {t('account.deleteResolveTransfer')}
            </Text>
            <Text style={styles.resolutionOption}>
              {t('account.deleteResolveRemoveMembers')}
            </Text>
            <Text style={styles.resolutionOption}>
              {t('account.deleteResolveDeleteHome')}
            </Text>
          </View>
        </View>
      ))}

      <AppPressable style={styles.goBackButton} onPress={goBack}>
        <Text style={styles.goBackButtonText}>{t('labels.goBack')}</Text>
      </AppPressable>
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
          <Icon name="warning-outline" size={48} tone="error" />
          <Text style={styles.warningTitle}>
            {t('account.deleteWarningTitle')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('account.deleteWhatWillBeDeleted')}
          </Text>
          <View style={styles.bulletPoint}>
            <Icon name="close-circle-outline" size={20} tone="error" />
            <Text style={styles.bulletText}>
              {t('account.deleteWipeProfile')}
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon name="close-circle-outline" size={20} tone="error" />
            <Text style={styles.bulletText}>
              {t('account.deleteWipePantry')}
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon name="close-circle-outline" size={20} tone="error" />
            <Text style={styles.bulletText}>
              {t('account.deleteWipeShoppingLists')}
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Icon name="close-circle-outline" size={20} tone="error" />
            <Text style={styles.bulletText}>
              {t('account.deleteWipePreferences')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('account.deleteBeforeYouProceed')}
          </Text>
          <Text style={styles.text}>
            • {t('account.deleteProceedIrreversible')}
          </Text>
          <Text style={styles.text}>• {t('account.deleteProceedLogout')}</Text>
          <Text style={styles.text}>
            • {t('account.deleteProceedNoRecovery')}
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationLabel}>
            {t('account.deleteTypeConfirm')}
          </Text>
          <BaseInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={t('account.deleteTypePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isDeleting}
          />
        </View>

        <AppPressable
          style={[
            styles.deleteButton,
            (confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting) &&
              styles.deleteButtonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
        >
          <Text style={styles.deleteButtonText}>
            {isDeleting
              ? t('account.deleteInProgress')
              : t('account.deleteForever')}
          </Text>
        </AppPressable>

        <AppPressable
          style={styles.cancelButton}
          onPress={goBack}
          disabled={isDeleting}
        >
          <Text style={styles.cancelButtonText}>{t('labels.cancel')}</Text>
        </AppPressable>
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
    <ThemedSafeAreaView style={styles.container} edges={['left', 'right']}>
      <Header title={t('account.deleteTitle')} onBack={goBack} centerTitle />

      {renderContent()}
    </ThemedSafeAreaView>
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  blockedWarningTitle: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.warning,
    marginTop: theme.spacing['3'],
  },
  blockedDescription: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  blockerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    marginBottom: theme.spacing.xs,
  },
  goBackButton: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  warningTitle: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.error,
    marginTop: theme.spacing['3'],
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
  },
  bulletText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing['3'],
    flex: 1,
  },
  text: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.fonts.size.sm * 1.5,
  },
  bold: {
    fontWeight: theme.fonts.weight.bold,
  },
  confirmationSection: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  confirmationLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
