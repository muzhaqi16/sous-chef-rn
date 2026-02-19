import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, { BottomSheetBackdropProps, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { Header } from '#components/molecules/Header';
import type { StepFormState } from '../useRecipeForm';

export interface RecipeStepEditorRef {
  open: (step?: StepFormState) => void;
  close: () => void;
}

interface RecipeStepEditorProps {
  onSave: (step: StepFormState) => void;
}

let stepTempIdCounter = 100;

export const RecipeStepEditor = forwardRef<RecipeStepEditorRef, RecipeStepEditorProps>(
  ({ onSave }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
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
        bottomSheetRef.current?.expand();
      },
      close: () => bottomSheetRef.current?.close(),
    }));

    const handleSave = useCallback(() => {
      if (!instruction.trim()) return;
      onSave({
        id: editingId ?? `temp-step-${stepTempIdCounter++}`,
        instruction: instruction.trim(),
        sortOrder: 0,
      });
      bottomSheetRef.current?.close();
    }, [editingId, instruction, onSave]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <Header
          title={editingId ? 'Edit Step' : 'Add Step'}
          centerTitle
          leftActions={[{
            icon: 'close',
            onPress: () => bottomSheetRef.current?.close(),
          }]}
          rightActions={[{
            icon: 'check',
            onPress: handleSave,
          }]}
        />

        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <FormTextArea
            label="Instruction"
            value={instruction}
            onChangeText={setInstruction}
            placeholder="Describe what to do in this step..."
            required
          />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

RecipeStepEditor.displayName = 'RecipeStepEditor';

const styles = StyleSheet.create(theme => ({
  handleIndicator: {
    backgroundColor: theme.colors.textTertiary,
  },
  sheetBackground: {
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
}));
