import React from 'react';
import { BaseInput } from '#components';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { FormCheckbox } from '#components/molecules/FormCheckbox';

export type FormValues = {
  homeName: string;
  pantryName: string;
  allowJoinCode?: boolean;
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
              {
                name: 'allowJoinCode' as const,
                label: 'Allow others to join with a code',
                component: FormCheckbox,
                props: { componentType: 'checkbox' },
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
