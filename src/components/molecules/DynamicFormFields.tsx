import React from 'react';
import {View, Text} from 'react-native';
import {
  type FieldValues,
  Control,
  Controller,
  FieldErrors,
  Path,
} from 'react-hook-form';

import {StyleSheet} from 'react-native-unistyles';

export type FieldDef<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  // For select fields
  options?: Array<{label: string; value: string}>;
  // For checkbox fields
  onValueChange?: (value: any) => void;
  // For custom rendering logic
  renderValue?: (value: any) => string;
  // For custom value transformation before validation
  transformValue?: (value: any) => any;
  // Transform only on blur, not on every keystroke
  transformOnBlur?: boolean;
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
  return (
    <View style={styles.container}>
      {fields.map(
        ({name, label, placeholder, component: Input, props, options, onValueChange, renderValue, transformValue, transformOnBlur}, idx) => (
          <React.Fragment key={String(name)}>
            <Controller
              control={control}
              name={name}
              render={({field: {onChange, onBlur, value}}) => {
                // Custom onChange handler that transforms value if needed
                const handleChange = (newValue: any) => {
                  // Only transform if not set to transform on blur
                  const transformedValue = (transformValue && !transformOnBlur) ? transformValue(newValue) : newValue;
                  onChange(transformedValue);
                };
                
                // Custom onBlur handler that transforms value if needed
                const handleBlur = () => {
                  if (transformValue && transformOnBlur) {
                    const transformedValue = transformValue(value);
                    onChange(transformedValue);
                  }
                  onBlur();
                };
                // Handle different input types and their specific props
                const inputProps: any = {
                  label,
                  ...(placeholder && {placeholder}),
                  ...props,
                };

                // Handle value rendering (e.g., for tags array)
                const displayValue = renderValue ? renderValue(value) : value;

                // Different prop patterns for different component types
                switch (props?.componentType) {
                  case 'select':
                    return (
                      <Input
                        {...inputProps}
                        value={value || ''}
                        onValueChange={handleChange}
                        options={options || []}
                      />
                    );
                  
                  case 'checkbox':
                    return (
                      <Input
                        {...inputProps}
                        checked={value || false}
                        onPress={() => handleChange(!value)}
                      />
                    );
                  
                  case 'number':
                    return (
                      <Input
                        {...inputProps}
                        value={value?.toString() || ''}
                        onChangeText={handleChange}
                        onBlur={onBlur}
                        error={errors[name]?.message}
                      />
                    );
                  
                  case 'autocomplete':
                    return (
                      <Input
                        {...inputProps}
                        value={displayValue || ''}
                        onChangeText={handleChange}
                        error={errors[name]?.message}
                      />
                    );
                  
                  default:
                    // Default input/textarea handling
                    return (
                      <Input
                        {...inputProps}
                        value={displayValue || ''}
                        onChangeText={handleChange}
                        onBlur={handleBlur}
                        error={errors[name]?.message}
                      />
                    );
                }
              }}
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

const styles = StyleSheet.create(theme => ({
  container: {
    width: '100%',
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.error,
  },
}));
