import React from 'react';
import {Text, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {BaseInput} from '#components';
import {DynamicFormFields} from '#components/molecules/DynamicFormFields';

export type FormValues = {
  homeName: string;
  pantryName: string;
};

export const FormContent = ({
  form,
  needsHome,
  existingHomeName,
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
          name: 'pantryName' as const,
          label: needsHome ? 'Default Pantry Name' : 'Pantry Name',
          placeholder: 'e.g. Kitchen Pantry',
          component: BaseInput,
        },
      ]}
      control={form.control}
      errors={form.formState.errors}
    />

    {!needsHome && existingHomeName && (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Using existing home: {existingHomeName}
        </Text>
      </View>
    )}
  </>
);

const styles = StyleSheet.create(theme => ({
  infoBox: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
  },
}));
