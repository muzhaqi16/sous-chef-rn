import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { Header } from '#components/molecules/Header';
import { generateId } from '#/utils/generateId';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import type { StepFormState } from '../useRecipeForm';

export interface RecipeStepEditorRef {
  open: (step?: StepFormState) => void;
  close: () => void;
}

interface RecipeStepEditorProps {
  onSave: (step: StepFormState) => void;
}

export const RecipeStepEditor = forwardRef<
  RecipeStepEditorRef,
  RecipeStepEditorProps
>(({ onSave }, ref) => {
  const { t } = useTranslation();
  // Per CLAUDE.md: never call present()/dismiss() outside an effect.
  // Drive sheet visibility from internal state, dispatched via effect.
  const [visible, setVisible] = useState(false);
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: () => setVisible(false),
    snapPoints: ['50%'],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');

  useImperativeHandle(ref, () => ({
    open: (step?: StepFormState) => {
      if (step) {
        setEditingId(step.id);
        setInstruction(step.instruction);
      } else {
        setEditingId(null);
        setInstruction('');
      }
      setVisible(true);
    },
    close: () => setVisible(false),
  }));

  const handleSave = () => {
    if (!instruction.trim()) return;
    onSave({
      id: editingId ?? `temp-step-${generateId()}`,
      instruction: instruction.trim(),
      sortOrder: 0,
    });
    setVisible(false);
  };

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps} index={0}>
      <Header
        title={editingId ? t('recipes.editStep') : t('recipes.addStep')}
        centerTitle
        leftActions={[
          {
            icon: 'close',
            onPress: () => setVisible(false),
          },
        ]}
        rightActions={[
          {
            icon: 'checkmark',
            onPress: handleSave,
          },
        ]}
      />

      <BottomSheetView style={styles.content}>
        <FormTextArea
          label={t('recipes.instruction')}
          value={instruction}
          onChangeText={setInstruction}
          placeholder={t('recipes.stepInstructionPlaceholder')}
          required
          useBottomSheetInput
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

RecipeStepEditor.displayName = 'RecipeStepEditor';

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
}));
