// components/molecules/DynamicFormFields.tsx
import React from 'react';
import {View, Text} from 'react-native';
import {
  type FieldValues,
  Control,
  Controller,
  FieldErrors,
  Path,
} from 'react-hook-form';

import {createStyleSheet, useStyles} from 'react-native-unistyles';

export type FieldDef<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  component: React.ComponentType<{
    label: string;
    value: any;
    onChangeText: (val: any) => void;
    onBlur: () => void;
    placeholder?: string;
  }>;
  props?: Record<string, any>;
};

interface DynamicFormFieldsProps<T extends FieldValues> {
  fields: FieldDef<T>[];
  control: Control<T>; // two‐generic Control<T, Context>
  errors: FieldErrors<T>;
}

export function DynamicFormFields<T extends FieldValues>({
  fields,
  control,
  errors,
}: DynamicFormFieldsProps<T>) {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      {fields.map(
        ({name, label, placeholder, component: Input, props}, idx) => (
          <React.Fragment key={String(name)}>
            <Controller
              control={control}
              name={name}
              render={({field: {onChange, onBlur, value}}) => (
                <Input
                  label={label}
                  value={value}
                  // if placeholder is provided, pass it to the component without overriding EmailInput and PasswordInput
                  {...(placeholder && {placeholder})}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  // pass any extra props defined in the field definition
                  {...props}
                />
              )}
            />
            {errors[name] && (
              <Text style={styles.errorText}>
                {errors[name]?.message?.toString()}
              </Text>
            )}
          </React.Fragment>
        ),
      )}
    </View>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: '100%',
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.error,
  },
}));
