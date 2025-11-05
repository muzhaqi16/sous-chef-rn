import React from 'react';
import { BaseInput } from '#components';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';

export type FormValues = {
  homeName: string;
  pantryName: string;
};

export const FormContent = ({
  form,
  needsHome,
}: {
  form: any;
  needsHome: boolean;
  existingHomeName?: string;
}) => (
  <>
    <DynamicFormFields<FormValues>
      fields={[
        ...(needsHome
          ? [
              {
                name: 'homeName' as const,
                label: 'Home Name',
                placeholder: 'e.g. Smith Family Home',
                component: BaseInput,
              },
            ]
          : []),
        {
          name: 'pantryName',
          label: needsHome ? 'Default Pantry Name' : 'Pantry Name',
          placeholder: 'e.g. Kitchen Pantry',
          component: BaseInput,
        },
      ]}
      control={form.control}
      errors={form.formState.errors}
    />
  </>
);
