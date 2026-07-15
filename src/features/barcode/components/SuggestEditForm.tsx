import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import AddItemForm, {
  type AddItemSubmitPayload,
} from '#components/organisms/AddItemForm/AddItemForm';
import { useItemForEdit } from '#hooks/items/useItemForEdit';
import { useSuggestItemEdit } from '#hooks/items/useSuggestItemEdit';
import { useIsAdminUser } from '#store/useAppStore';
import {
  buildInitialDataFromSnapshot,
  resolveItemEditRoute,
} from '#utils/items/suggestItemChanges';

interface SuggestEditFormProps {
  itemId: string;
  barcode?: string;
  format?: string;
  onClose: () => void;
}

/**
 * Edit sheet for a scanned catalog item.
 *
 * A separate component so `useItemForEdit` receives a real item id
 * unconditionally, and so AddItemForm only mounts once the snapshot is loaded —
 * react-hook-form reads `defaultValues` on mount, so prefilling later would not
 * take effect.
 */
export const SuggestEditForm: React.FC<SuggestEditFormProps> = ({
  itemId,
  barcode,
  format,
  onClose,
}) => {
  const isAdmin = useIsAdminUser();
  const { snapshot } = useItemForEdit(itemId);
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

  if (!snapshot) {
    return (
      <View style={styles.loading}>
        <ThemedActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AddItemForm
      barcode={barcode}
      format={format}
      mode={
        resolveItemEditRoute(snapshot.visibility, isAdmin) === 'direct'
          ? 'directEdit'
          : 'edit'
      }
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
}));
