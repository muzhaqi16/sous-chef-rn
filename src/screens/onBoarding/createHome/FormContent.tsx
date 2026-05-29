import React from 'react';
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
  const homeField: FieldDef<FormValues> = {
    name: 'homeName',
    label: 'Home Name',
    placeholder: 'e.g. Smith Family Home',
    component: BaseInput,
  };

  const fields: FieldDef<FormValues>[] = [
    ...(needsHome ? [homeField] : []),
    {
      name: 'pantryName',
      label: needsHome ? 'Default Pantry Name' : 'Pantry Name',
      placeholder: 'e.g. Kitchen Pantry',
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
