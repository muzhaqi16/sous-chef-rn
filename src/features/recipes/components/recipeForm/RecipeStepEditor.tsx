import React from 'react';
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

interface RecipeStepEditorProps {
  visible: boolean;
  /** The step being edited; absent, a new one. */
  step?: StepFormState;
  onDismiss: () => void;
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

export const RecipeStepEditor: React.FC<RecipeStepEditorProps> = ({
  visible,
  step,
  onDismiss,
  onSave,
}) => {
  const opening = useOpening(visible, step);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['50%']}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <StepForm
          key={opening.id}
          step={opening.payload}
          onSave={onSave}
          onClose={onDismiss}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingBottom: theme.spacing.xl,
  },
}));
