import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { generateId } from '#utils/generateId';
import { lazyMessage, reportValidationErrors } from '#utils/validation/common';
import type { StepFormState } from '#features/recipes/types';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

export interface RecipeStepEditorRef {
  open: (step?: StepFormState) => void;
  close: () => void;
}

interface RecipeStepEditorProps {
  onSave: (step: StepFormState) => void;
}

interface StepFormValues {
  instruction: string;
}

const stepSchema: ObjectSchema<StepFormValues> = object({
  instruction: string()
    .trim()
    .required(lazyMessage('recipes.instructionRequired')),
});

interface StepFormProps {
  /** The step being edited; absent for a new one. */
  step: StepFormState | undefined;
  onSave: (step: StepFormState) => void;
  onClose: () => void;
}

/** One opening, on the step's instruction or empty for a new step. */
const StepForm: React.FC<StepFormProps> = ({ step, onSave, onClose }) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<StepFormValues>({
    resolver: yupResolver(stepSchema),
    defaultValues: { instruction: step?.instruction ?? '' },
  });
  useSheetUnsavedInput(isDirty);

  const save = handleSubmit(({ instruction }) => {
    onSave({
      id: step?.id ?? `temp-step-${generateId()}`,
      instruction,
      sortOrder: 0,
    });
    onClose();
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={step ? t('recipes.editStep') : t('recipes.addStep')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
          }}
        />
      </SheetHeaderSlot>
      <Controller
        control={control}
        name="instruction"
        render={({ field, fieldState }) => (
          <FormTextArea
            label={t('recipes.instruction')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.stepInstructionPlaceholder')}
            error={fieldState.error?.message}
            required
          />
        )}
      />
    </>
  );
};

export const RecipeStepEditor = forwardRef<
  RecipeStepEditorRef,
  RecipeStepEditorProps
>(({ onSave }, ref) => {
  // The screen opens it through the ref; what opens it is held here.
  const [request, setRequest] = useState<{
    visible: boolean;
    step?: StepFormState;
  }>({ visible: false });
  const opening = useOpening(request.visible, request.step);
  const close = () => setRequest(prev => ({ ...prev, visible: false }));

  useImperativeHandle(ref, () => ({
    open: (step?: StepFormState) => setRequest({ visible: true, step }),
    close,
  }));

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={request.visible}
      onDismiss={close}
      snapPoints={['50%']}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <StepForm
          key={opening.id}
          step={opening.payload}
          onSave={onSave}
          onClose={close}
        />
      ) : null}
    </Sheet>
  );
});

RecipeStepEditor.displayName = 'RecipeStepEditor';

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
}));
