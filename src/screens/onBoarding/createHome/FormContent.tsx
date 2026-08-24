import React from 'react';
import { useTranslation } from '#/i18n';
import type { UseFormReturn } from 'react-hook-form';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import {
  DynamicFormFields,
  type FieldDef,
} from '#components/molecules/DynamicFormFields';

export type FormValues = {
  homeName: string;
  pantryName: string;
};

export const FormContent = ({
  form,
  needsHome,
}: {
  form: UseFormReturn<FormValues>;
  needsHome: boolean;
  existingHomeName?: string;
}) => {
  const { t } = useTranslation();

  const homeField: FieldDef<FormValues> = {
    name: 'homeName',
    label: t('labels.homeName'),
    placeholder: t('onBoarding.homeNamePlaceholder'),
    component: BaseInput,
  };

  const fields: FieldDef<FormValues>[] = [
    ...(needsHome ? [homeField] : []),
    {
      name: 'pantryName',
      label: needsHome
        ? t('onBoarding.defaultPantryNameLabel')
        : t('labels.pantryName'),
      placeholder: t('onBoarding.pantryNamePlaceholder'),
      component: BaseInput,
    },
  ];

  return (
    <>
      <DynamicFormFields<FormValues>
        fields={fields}
        control={form.control}
        errors={form.formState.errors}
      />
    </>
  );
};
