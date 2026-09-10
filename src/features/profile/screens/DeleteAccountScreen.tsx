import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#/utils/iconUtils';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Loading } from '#components/molecules/Loading';
import {
  useDeleteAccount,
  type DeleteAccountResult,
} from '#features/profile/hooks/useDeleteAccount';
import { authService } from '#/services/authService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Screen } from '#components/templates/Screen';

/** Module-level so the await chain does not bail the screen out of the compiler. */
async function performDeleteAccount(
  deleteAccount: () => Promise<DeleteAccountResult>,
  setIsDeleting: (v: boolean) => void,
  rejectionMessage: string,
): Promise<void> {
  setIsDeleting(true);
  const result = await deleteAccount();
  // Transport error — already reported by the hook.
  if (!result) {
    setIsDeleting(false);
    return;
  }

  // A ForbiddenError/ValidationError member resolves WITHOUT throwing under
  // errorPolicy:'all' — only the success payload logs the user out.
  if (alertIfRejected(result, rejectionMessage)) {
    setIsDeleting(false);
    return;
  }
  // The account is gone, so its keychain slot goes with it and the credential
  // is revoked server-side. That is the DEFAULT; the deliberate sign-out is the
  // one that opts out of it — see `LogoutOptions` in authService.
  authService.logout();
}

export const DeleteAccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Error/success handling lives in `performDeleteAccount` so a resolved error
  // member cannot trigger logout.
  const {
    canDelete,
    blockers,
    checkingEligibility,
    eligibilityError,
    refetchEligibility,
    deleteAccount,
  } = useDeleteAccount();

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
              deleteAccount,
              setIsDeleting,
              t('account.deleteGenericError'),
            ),
        },
      ],
    );
  };

  const renderLoadingState = () => (
    <Loading message={t('account.deleteCheckingStatus')} />
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Icon name="alert-circle-outline" size={48} tone="error" />
      <Text role="heading" style={styles.errorTitle}>
        {t('account.deleteUnableToCheck')}
      </Text>
      <Text role="body" style={styles.errorText}>
        {eligibilityError?.message || t('account.deleteGenericError')}
      </Text>
      <AppPressable
        style={styles.retryButton}
        onPress={() => refetchEligibility()}
      >
        <Text role="bodyStrong" style={styles.retryButtonText}>
          {t('labels.retry')}
        </Text>
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
        <Text role="subheading" style={styles.blockedWarningTitle}>
          {t('account.deleteBlockedTitle')}
        </Text>
      </View>

      <Text role="body" style={styles.blockedDescription}>
        {t('account.deleteBlockedSubtitle')}
      </Text>

      {blockers.map((blocker, index) => (
        <View key={blocker.resourceId || index} style={styles.blockerCard}>
          <View style={styles.blockerHeader}>
            <Icon name="home-outline" size={20} tone="primary" />
            <Text role="bodyStrong" style={styles.blockerResourceName}>
              {blocker.resourceName}
            </Text>
          </View>
          <Text role="caption" style={styles.blockerMessage}>
            {blocker.message}
          </Text>
          <View style={styles.resolutionSection}>
            <Text role="label" style={styles.resolutionTitle}>
              {t('account.deleteResolveTitle')}
            </Text>
            <Text role="caption" style={styles.resolutionOption}>
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
        <Text role="bodyStrong" style={styles.goBackButtonText}>
          {t('labels.goBack')}
        </Text>
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
          <Text role="subheading" style={styles.warningTitle}>
            {t('account.deleteWarningTitle')}
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeader style={styles.sectionTitleSpacing}>
            {t('account.deleteWhatWillBeDeleted')}
          </SectionHeader>
          <View style={styles.bulletPoint}>
            <Icon name="close-circle-outline" size={20} tone="error" />
            <Text role="caption" style={styles.bulletText}>
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
          <SectionHeader style={styles.sectionTitleSpacing}>
            {t('account.deleteBeforeYouProceed')}
          </SectionHeader>
          <Text role="caption" style={styles.text}>
            • {t('account.deleteProceedIrreversible')}
          </Text>
          <Text style={styles.text}>• {t('account.deleteProceedLogout')}</Text>
          <Text style={styles.text}>
            • {t('account.deleteProceedNoRecovery')}
          </Text>
        </View>

        <View style={styles.confirmationSection}>
          <Text role="body" style={styles.confirmationLabel}>
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
          <Text role="bodyStrong" style={styles.deleteButtonText}>
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
          <Text role="bodyStrong" style={styles.cancelButtonText}>
            {t('labels.cancel')}
          </Text>
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
    <Screen
      header={{
        title: t('account.deleteTitle'),
        back: goBack,
        centerTitle: true,
      }}
      scroll="list"
      gutter="none"
    >
      {renderContent()}
    </Screen>
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
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    marginTop: theme.spacing.sm,
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
    color: theme.colors.onPrimary,
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
    color: theme.colors.warning,
    marginTop: theme.spacing.base,
  },
  blockedDescription: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  blockerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  blockerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  blockerResourceName: {
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.sm,
  },
  blockerMessage: {
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
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  resolutionOption: {
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
    color: theme.colors.onPrimary,
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
    color: theme.colors.error,
    marginTop: theme.spacing.base,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
  },
  bulletText: {
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.base,
    flex: 1,
  },
  text: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  confirmationSection: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  confirmationLabel: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.base,
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
    color: theme.colors.onError,
  },
  cancelButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.base,
  },
}));

export default DeleteAccountScreen;
