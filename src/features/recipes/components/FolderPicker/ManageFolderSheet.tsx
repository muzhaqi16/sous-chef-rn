import React from 'react';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { StyleSheet } from 'react-native-unistyles';
import {
  OnPrimaryActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';

export interface ManageFolderSheetProps {
  visible: boolean;
  /** Runs once this sheet has finished closing, however it closed. */
  onDismiss: () => void;
  /** Folder currently being managed (drives the displayed name). */
  managingFolder: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  showDeleteConfirm: boolean;
  onShowDeleteConfirm: (value: boolean) => void;
  onRenameConfirm: () => void;
  onDeleteConfirm: () => void;
  onClose: () => void;
  folderActionLoading: boolean;
  /** Whether rename is available (parent supplied an onRenameFolder). */
  canRename: boolean;
  /** Whether delete is available (parent supplied an onDeleteFolder). */
  canDelete: boolean;
}

/**
 * Rename / delete bottom sheet for a single folder. Presentational — the
 * parent {@link FolderPicker} owns all folder state and the rename/delete
 * orchestration; this component only renders the manage UI and forwards
 * intent via callbacks.
 */
export const ManageFolderSheet: React.FC<ManageFolderSheetProps> = ({
  visible,
  onDismiss,
  managingFolder,
  renameValue,
  onRenameValueChange,
  showDeleteConfirm,
  onShowDeleteConfirm,
  onRenameConfirm,
  onDeleteConfirm,
  onClose,
  folderActionLoading,
  canRename,
  canDelete,
}) => {
  const { t } = useTranslation();
  const renameDisabled =
    !renameValue.trim() || renameValue.trim() === managingFolder;

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['45%']}
      contentContainerStyle={styles.bottomSheetContent}
      header={
        <SheetHeader title={t('folderPicker.manageTitle')} onClose={onClose} />
      }
    >
      {/* Current folder name */}
      <View style={styles.currentFolderContainer}>
        <Icon name="folder-outline" size="sm" tone="primary" />
        <Text role="bodyStrong" tone="accent">
          {managingFolder}
        </Text>
      </View>

      {/* Delete Confirmation View */}
      {showDeleteConfirm ? (
        <View style={styles.deleteConfirmContainer}>
          <Icon name="warning-outline" size="lg" tone="error" />
          <Text role="heading" style={styles.deleteConfirmTitle}>
            {managingFolder
              ? t('labels.deleteNamed', { name: managingFolder })
              : t('folderPicker.deleteFolder')}
          </Text>
          <Text
            role="body"
            tone="secondary"
            align="center"
            style={styles.deleteConfirmText}
          >
            {t('folderPicker.deleteConfirmBody', {
              folder: t('labels.noFolder'),
            })}
          </Text>
          <View style={styles.deleteConfirmButtons}>
            <AppPressable
              style={styles.deleteConfirmCancelButton}
              onPress={() => onShowDeleteConfirm(false)}
              disabled={folderActionLoading}
            >
              <Text role="bodyStrong">{t('labels.cancel')}</Text>
            </AppPressable>
            <AppPressable
              style={styles.deleteConfirmDeleteButton}
              onPress={onDeleteConfirm}
              disabled={folderActionLoading}
            >
              {folderActionLoading ? (
                <OnPrimaryActivityIndicator size="small" />
              ) : (
                <Text role="bodyStrong" style={styles.deleteConfirmDeleteText}>
                  {t('labels.delete')}
                </Text>
              )}
            </AppPressable>
          </View>
        </View>
      ) : (
        <>
          {/* Rename Section */}
          {!!canRename && (
            <View style={styles.renameSection}>
              <SectionHeader variant="overline" style={styles.sectionLabel}>
                {t('labels.rename')}
              </SectionHeader>
              <View style={styles.renameInputRow}>
                <ThemedBottomSheetTextInput
                  style={styles.renameInput}
                  defaultValue={renameValue}
                  onChangeText={onRenameValueChange}
                  placeholder={t('folderPicker.renamePlaceholder')}
                  autoCapitalize="words"
                  onSubmitEditing={onRenameConfirm}
                  editable={!folderActionLoading}
                />
                <AppPressable
                  style={[
                    styles.renameButton,
                    renameDisabled && styles.renameButtonDisabled,
                  ]}
                  onPress={onRenameConfirm}
                  disabled={renameDisabled || folderActionLoading}
                >
                  {folderActionLoading ? (
                    <OnPrimaryActivityIndicator size="small" />
                  ) : (
                    <Text
                      role="bodyStrong"
                      style={[
                        styles.renameButtonText,
                        renameDisabled && styles.renameButtonTextDisabled,
                      ]}
                    >
                      {t('labels.rename')}
                    </Text>
                  )}
                </AppPressable>
              </View>
            </View>
          )}

          {/* Delete Section */}
          {!!canDelete && (
            <View style={styles.deleteSection}>
              <AppPressable
                style={styles.deleteButton}
                onPress={() => onShowDeleteConfirm(true)}
                disabled={folderActionLoading}
              >
                <Icon name="trash-outline" size="xsPlus" tone="error" />
                <Text role="bodyStrong" tone="danger">
                  {t('folderPicker.deleteFolder')}
                </Text>
              </AppPressable>
              <Text
                role="caption"
                tone="secondary"
                align="center"
                style={styles.deleteDescription}
              >
                {t('folderPicker.deleteHint')}
              </Text>
            </View>
          )}
        </>
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    padding: theme.spacing.mdPlus,
  },
  currentFolderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  renameSection: {
    marginBottom: theme.spacing.lg,
  },
  renameInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  renameInput: {
    flex: 1,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
  },
  renameButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  renameButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  renameButtonText: {
    color: theme.colors.onPrimary,
  },
  renameButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  deleteSection: {
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  deleteDescription: {
    marginTop: theme.spacing.xs,
  },
  deleteConfirmContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  deleteConfirmTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  deleteConfirmText: {
    marginBottom: theme.spacing.lg,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  deleteConfirmCancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  deleteConfirmDeleteButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  deleteConfirmDeleteText: {
    color: theme.colors.onError,
  },
}));
