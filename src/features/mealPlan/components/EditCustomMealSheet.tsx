import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { type EditCustomMealSheet_ItemFragment } from './EditCustomMealSheet.generated';
import { Text } from '#components/atoms/Text';

interface EditCustomMealSheetProps {
  visible: boolean;
  item: EditCustomMealSheet_ItemFragment | null;
  onClose: () => void;
  onSave: (
    id: string,
    input: { customMealName?: string; notes?: string },
  ) => void;
}

export const EditCustomMealSheet: React.FC<EditCustomMealSheetProps> = ({
  visible,
  item,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['45%'],
    keyboardAware: true,
  });

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
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <BottomSheetHeader
          title={t('editCustomMeal.title')}
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel={t('editCustomMeal.save')}
        />

        <View style={styles.previewSection}>
          <Text size="sm" weight="medium" tone="secondary">
            {item?.mealType?.charAt(0).toUpperCase()}
            {item?.mealType?.slice(1).toLowerCase()}
          </Text>
        </View>

        <View style={styles.section}>
          <FormInput
            label={t('editCustomMeal.mealName')}
            value={name}
            onChangeText={setName}
            placeholder={t('editCustomMeal.mealNamePlaceholder')}
          />
        </View>

        <View style={styles.section}>
          <FormInput
            label={t('editCustomMeal.notesLabel')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('editCustomMeal.notesPlaceholder')}
            multiline
            numberOfLines={3}
          />
        </View>
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};

EditCustomMealSheet.displayName = 'EditCustomMealSheet';

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  previewSection: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
}));
