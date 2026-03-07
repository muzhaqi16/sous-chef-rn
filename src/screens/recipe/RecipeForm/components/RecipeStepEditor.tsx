import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
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
    const bottomSheetRef = useRef<BottomSheetModal>(null);
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
      close: () => bottomSheetRef.current?.dismiss() }));

    const handleSave = () => {
      if (!instruction.trim()) return;
      onSave({
        id: editingId ?? `temp-step-${generateId()}`,
        instruction: instruction.trim(),
        sortOrder: 0 });
      bottomSheetRef.current?.dismiss();
    };

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} onClose={() => bottomSheetRef.current?.dismiss()} />
      );

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['50%', '95%']}
        enableDynamicSizing={false}
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
            onPress: () => bottomSheetRef.current?.dismiss() }]}
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
      </BottomSheetModal>
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
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl } }));
