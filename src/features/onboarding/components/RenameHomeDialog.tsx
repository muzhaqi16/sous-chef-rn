import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object } from 'yup';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { Dialog, DialogBody, DialogFooter } from '#components/templates/Dialog';
import {
  cleanName,
  homeNameRule,
  reportValidationErrors,
} from '#/utils/validation/common';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

const renameHomeSchema = object({ name: homeNameRule });

interface RenameHomeDialogProps {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  /** Resolves true once the name landed or queued; false keeps the dialog. */
  onRename: (name: string) => Promise<boolean>;
}

/** Renames the home from the first question. Mounts fresh on each open. */
export const RenameHomeDialog = ({
  visible,
  currentName,
  onClose,
  onRename,
}: RenameHomeDialogProps) => (
  <Dialog visible={visible} onRequestClose={onClose}>
    <RenameHomeForm
      currentName={currentName}
      onClose={onClose}
      onRename={onRename}
    />
  </Dialog>
);

const RenameHomeForm = ({
  currentName,
  onClose,
  onRename,
}: Omit<RenameHomeDialogProps, 'visible'>) => {
  const { t } = useTranslation();
  const form = useForm({
    resolver: yupResolver(renameHomeSchema),
    defaultValues: { name: currentName },
  });

  const save = form.handleSubmit(async ({ name }) => {
    // The rule tidies a name ("my home" → "My Home"): an untouched one is no
    // rename.
    if (name === cleanName(currentName) || (await onRename(name))) onClose();
  }, reportValidationErrors);

  return (
    <>
      <DialogBody>
        <Text role="title">{t('onBoarding.renameHomeTitle')}</Text>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <BaseInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => {
                void save();
              }}
              accessibilityLabel={t('labels.homeName')}
              errorMessage={fieldState.error?.message}
              testID={onboardingTestIDs.renameHomeInput}
            />
          )}
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" title={t('labels.cancel')} onPress={onClose} />
        <Button
          title={t('labels.save')}
          onPress={() => {
            void save();
          }}
          loading={form.formState.isSubmitting}
          testID={onboardingTestIDs.renameHomeSave}
        />
      </DialogFooter>
    </>
  );
};
