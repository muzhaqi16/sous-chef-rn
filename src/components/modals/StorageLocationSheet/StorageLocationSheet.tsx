import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useBottomSheetBackHandler } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  StorageLocationForm,
  StorageLocationFormRef,
} from '#components/organisms/storageLocation';

interface StorageLocationData {
  name: string;
  type: string;
  icon?: string | null;
  parentLocationId?: string;
}

interface StorageLocation {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  parentLocationId?: string | null;
}

interface StorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: StorageLocationData) => Promise<boolean | void>;
  initialData?: StorageLocation | null;
  availableLocations: Array<{ id: string; name: string; type: string }>;
  isSubmitting?: boolean;
}

export const StorageLocationSheet: React.FC<StorageLocationSheetProps> = ({
  visible,
  onClose,
  onSubmit,
  initialData,
  availableLocations,
  isSubmitting = false,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const formRef = useRef<StorageLocationFormRef>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSubmit = useCallback(
    async (data: StorageLocationData) => {
      const result = await onSubmit(data);
      if (result !== false) {
        onClose();
      }
    },
    [onSubmit, onClose],
  );

  const handleHeaderSave = useCallback(() => {
    formRef.current?.submit();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <GlobalBottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const isEditing = !!initialData;
  const title = isEditing ? 'Edit Storage Location' : 'Add Storage Location';
  const saveText = isEditing ? 'Update' : 'Create';

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['70%', '90%']}
      index={0}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={isSubmitting}
          >
            <Text
              style={[styles.cancelText, { color: theme.colors.textSecondary }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>

          <TouchableOpacity
            onPress={handleHeaderSave}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={saveText}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text
                style={[styles.saveText, { color: theme.colors.primary }]}
              >
                {saveText}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Form */}
        <StorageLocationForm
          ref={formRef}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          availableLocations={availableLocations}
          hideActions
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  headerButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 60,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  saveText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginBottom: theme.spacing.lg,
  },
}));

export default StorageLocationSheet;
