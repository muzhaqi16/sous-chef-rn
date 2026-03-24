import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
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
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    onDismiss: () => {},
    snapPoints: ['50%'],
    keyboardBehavior: 'interactive',
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
      bottomSheetRef.current?.present();
    },
    close: () => bottomSheetRef.current?.dismiss(),
  }));

  const handleSave = () => {
    if (!instruction.trim()) return;
    onSave({
      id: editingId ?? `temp-step-${generateId()}`,
      instruction: instruction.trim(),
      sortOrder: 0,
    });
    bottomSheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal ref={bottomSheetRef} {...modalProps} index={0}>
      <Header
        title={editingId ? 'Edit Step' : 'Add Step'}
        centerTitle
        leftActions={[
          {
            icon: 'close',
            onPress: () => bottomSheetRef.current?.dismiss(),
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
          label="Instruction"
          value={instruction}
          onChangeText={setInstruction}
          placeholder="Describe what to do in this step..."
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
