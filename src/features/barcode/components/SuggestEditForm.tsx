import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { ErrorState } from '#components/molecules/ErrorState';
import AddItemForm, {
  type AddItemSubmitPayload,
} from '#features/catalog/ui/AddItemForm/AddItemForm';
import { useItemForEdit } from '#features/catalog/hooks/useItemForEdit';
import { useSuggestItemEdit } from '#features/catalog/hooks/useSuggestItemEdit';
import { buildInitialDataFromSnapshot } from '#utils/items/suggestItemChanges';

interface SuggestEditFormProps {
  itemId: string;
  barcode?: string;
  format?: string;
  onClose: () => void;
}

/**
 * Edit sheet for a scanned catalog item. Separate so `useItemForEdit` gets a
 * real id unconditionally and AddItemForm mounts only once the snapshot is in:
 * react-hook-form reads `defaultValues` on mount, so prefilling later is inert.
 */
export const SuggestEditForm: React.FC<SuggestEditFormProps> = ({
  itemId,
  barcode,
  format,
  onClose,
}) => {
  const { t } = useTranslation();
  const { snapshot, loading, error, refetch } = useItemForEdit(itemId);
  const { submitEdit, loading: submitting } = useSuggestItemEdit();

  const handleSubmit = async (formData: AddItemSubmitPayload) => {
    if (!snapshot) return;
    const result = await submitEdit(snapshot, formData);
    // Keep the sheet open when there's nothing to send or the send failed, so
    // the user's edits survive and they can correct and retry.
    if (result.status !== 'failed' && result.status !== 'noChanges') {
      onClose();
    }
  };

  // Without the snapshot there is nothing to diff against, so the form can't be
  // shown at all. Failing here has to say so — the alternative is a spinner that
  // never resolves and gives the user nothing to act on.
  if (!snapshot && error && !loading) {
    return (
      <ErrorState
        title={t('suggestItemEdit.loadFailedTitle')}
        message={t('suggestItemEdit.loadFailedBody')}
        onRetry={refetch}
        retryLabel={t('labels.tryAgain')}
        secondaryAction={{ label: t('labels.cancel'), onPress: onClose }}
        style={styles.error}
      />
    );
  }

  if (!snapshot) {
    return (
      <View style={styles.loading}>
        <ThemedActivityIndicator size="large" />
      </View>
    );
  }

  // Neither write path is open — a PRIVATE item this user doesn't own. Catches
  // a scan result whose flags were stale; the form would only be rejected on
  // submit.
  if (!snapshot.canEdit && !snapshot.canSuggest) {
    return (
      <ErrorState
        title={t('suggestItemEdit.readOnlyTitle')}
        message={t('suggestItemEdit.readOnlyBody')}
        secondaryAction={{ label: t('labels.close'), onPress: onClose }}
        style={styles.error}
      />
    );
  }

  return (
    <AddItemForm
      barcode={barcode}
      format={format}
      mode={snapshot.canEdit ? 'directEdit' : 'edit'}
      initialData={buildInitialDataFromSnapshot(snapshot)}
      onSubmit={handleSubmit}
      onClose={onClose}
      loading={submitting}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  loading: {
    paddingVertical: theme.spacing['3xl'],
    alignItems: 'center',
  },
  // ErrorState is flex:1 by default, which collapses inside the sheet's
  // scroll view.
  error: {
    flex: 0,
    paddingVertical: theme.spacing.xl,
  },
}));
