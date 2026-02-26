import React, { useState } from 'react';
import { View, Text } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import type { MealPlanItemFragment } from '#generated';

interface EditCustomMealSheetProps {
  visible: boolean;
  item: MealPlanItemFragment | null;
  onClose: () => void;
  onSave: (id: string, input: { customMealName?: string; notes?: string }) => void;
}

export const EditCustomMealSheet: React.FC<EditCustomMealSheetProps> = ({
  visible,
  item,
  onClose,
  onSave }) => {
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['45%'],
    keyboardBehavior: 'interactive' });

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevItem, setPrevItem] = useState(item);
  if (visible !== prevVisible || item !== prevItem) {
    setPrevVisible(visible);
    setPrevItem(item);
    if (visible && item) {
      setName(item.customMealName ?? '');
      setNotes(item.notes ?? '');
    }
  }

  const handleSave = () => {
    if (!item) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(item.id, {
      customMealName: trimmedName,
      notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title="Edit Custom Meal"
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel="Save"
        />

        <View style={styles.previewSection}>
          <Text style={styles.mealTypeLabel}>
            {item?.mealType?.charAt(0).toUpperCase()}{item?.mealType?.slice(1).toLowerCase()}
          </Text>
        </View>

        <View style={styles.section}>
          <FormInput
            label="Meal Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Grilled chicken with salad"
          />
        </View>

        <View style={styles.section}>
          <FormInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes about this meal..."
            multiline
            numberOfLines={3}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

EditCustomMealSheet.displayName = 'EditCustomMealSheet';

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1 },
  contentContainer: {
    padding: theme.spacing.md },
  previewSection: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    alignItems: 'center' },
  mealTypeLabel: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary },
  section: {
    marginBottom: theme.spacing.lg } }));
