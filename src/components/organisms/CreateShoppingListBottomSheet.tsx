import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BottomSheetHeader } from '#components/atoms';
import { useCreateShoppingListMutation } from '#generated';

interface CreateShoppingListBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateShoppingListBottomSheet: React.FC<
  CreateShoppingListBottomSheetProps
> = ({ visible, onClose, onSuccess }) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  const [listName, setListName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createShoppingList, { loading }] = useCreateShoppingListMutation();

  // Control bottom sheet visibility based on visible prop
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      // Reset form when modal opens
      setListName('');
      setError(null);
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleCreateList = useCallback(async () => {
    if (!listName.trim()) {
      setError('Please enter a list name');
      return;
    }

    try {
      await createShoppingList({
        variables: {
          input: {
            name: listName.trim(),
            isDefault: false,
            tags: [],
          },
        },
      });
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to create list';
      setError(errorMessage);
    }
  }, [listName, createShoppingList, onSuccess, onClose]);

  const handleCancel = useCallback(() => {
    setListName('');
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['35%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* Header */}
        <BottomSheetHeader
          title="New Shopping List"
          onCancel={handleCancel}
          onConfirm={handleCreateList}
          confirmLabel="Create"
          confirmDisabled={loading || !listName.trim()}
        />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>List Name *</Text>
          <BottomSheetTextInput
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: error ? theme.colors.error : theme.colors.border,
              },
            ]}
            value={listName}
            onChangeText={text => {
              setListName(text);
              if (error) setError(null);
            }}
            placeholder="Enter list name..."
            placeholderTextColor={theme.colors.textTertiary}
            autoFocus
            maxLength={50}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
  },
  inputContainer: {
    marginTop: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
}));

export default CreateShoppingListBottomSheet;
