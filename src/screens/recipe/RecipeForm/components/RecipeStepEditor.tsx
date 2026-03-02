import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { Header } from '#components/molecules/Header';
import { generateId } from '#/utils/generateId';
import type { StepFormState } from '../useRecipeForm';

export interface RecipeStepEditorRef {
  open: (step?: StepFormState) => void;
  close: () => void;
}

interface RecipeStepEditorProps {
  onSave: (step: StepFormState) => void;
}

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
      close: () => bottomSheetRef.current?.close() }));

    const handleSave = () => {
      if (!instruction.trim()) return;
      onSave({
        id: editingId ?? `temp-step-${generateId()}`,
        instruction: instruction.trim(),
        sortOrder: 0 });
      bottomSheetRef.current?.close();
    };

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} />
      );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%', '95%']}
        keyboardBehavior="interactive"
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
            onPress: () => bottomSheetRef.current?.close() }]}
          rightActions={[{
            icon: 'checkmark',
            onPress: handleSave }]}
        />

        <BottomSheetFormScrollView contentContainerStyle={styles.content}>
          <FormTextArea
            label="Instruction"
            value={instruction}
            onChangeText={setInstruction}
            placeholder="Describe what to do in this step..."
            required
          />
        </BottomSheetFormScrollView>
      </BottomSheet>
    );
  },
);

RecipeStepEditor.displayName = 'RecipeStepEditor';

const styles = StyleSheet.create(theme => ({
  handleIndicator: {
    backgroundColor: theme.colors.textTertiary },
  sheetBackground: {
    backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl } }));
