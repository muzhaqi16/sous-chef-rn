import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import {
  type FieldValues,
  Control,
  Controller,
  FieldErrors,
  Path,
} from 'react-hook-form';

import { StyleSheet } from 'react-native-unistyles';

// Import new unified autocomplete components
import { ItemAutocompleteField } from './AutocompleteField/ItemAutocompleteField';
import { BrandAutocompleteField } from './AutocompleteField/BrandAutocompleteField';
import { UnitAutocompleteField } from './AutocompleteField/UnitAutocompleteField';
import { CategoryAutocompleteField } from './AutocompleteField/CategoryAutocompleteField';
import { StorageLocationAutocompleteField } from './AutocompleteField/StorageLocationAutocompleteField';
import { FormInput } from './FormInput';

// Create memoized versions to prevent re-renders
const MemoizedItemAutocomplete = React.memo(ItemAutocompleteField);
const MemoizedBrandAutocomplete = React.memo(BrandAutocompleteField);
const MemoizedUnitsAutocomplete = React.memo(UnitAutocompleteField);
const MemoizedCategoryAutocomplete = React.memo(CategoryAutocompleteField);
const MemoizedStorageLocationAutocomplete = React.memo(StorageLocationAutocompleteField);

export type FieldDef<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  component?:
    | React.ComponentType<any>
    | 'itemAutocomplete'
    | 'brandAutocomplete'
    | 'unitAutocomplete'
    | 'categoryAutocomplete'
    | 'storageLocationAutocomplete';
  props?: Record<string, any>;
  // For select fields
  options?: Array<{ label: string; value: string }>;
  // For checkbox fields
  onValueChange?: (value: any) => void;
  // For custom rendering logic
  renderValue?: (value: any) => string;
  // For custom value transformation before validation
  transformValue?: (value: any) => any;
  // Transform only on blur, not on every keystroke
  transformOnBlur?: boolean;
  // Autocomplete specific props
  onSelectItem?: (item: any) => void;
  onUnitSelected?: (unitId: string | null, unitName: string | null) => void;
  onCategorySelected?: (categoryId: string | null) => void;
  onStorageLocationSelected?: (
    locationId: string | null,
    location: any,
  ) => void;
  onAddNewLocation?: (name: string) => void;
  storageLocations?: any[];
  testID?: string;
};

interface DynamicFormFieldsProps<T extends FieldValues> {
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
}

export function DynamicFormFields<T extends FieldValues>({
  fields,
  control,
  errors,
}: DynamicFormFieldsProps<T>) {
  // Memoize the field components to prevent recreation
  const memoizedFields = useMemo(() => {
    return fields.map(
      (
        {
          name,
          label,
          placeholder,
          component: Input,
          props,
          options,
          onValueChange,
          renderValue,
          transformValue,
          transformOnBlur,
          onSelectItem,
          onUnitSelected,
          onCategorySelected,
          onStorageLocationSelected,
          onAddNewLocation,
          storageLocations,
          testID,
        },
        idx,
      ) => ({
        name,
        label,
        placeholder,
        Input,
        props,
        options,
        onValueChange,
        renderValue,
        transformValue,
        transformOnBlur,
        onSelectItem,
        onUnitSelected,
        onCategorySelected,
        onStorageLocationSelected,
        onAddNewLocation,
        storageLocations,
        testID,
        key: `${String(name)}-${idx}`,
      }),
    );
  }, [fields]);

  return (
    <View style={styles.container}>
      {memoizedFields.map(
        ({
          name,
          label,
          placeholder,
          Input,
          props,
          options,
          renderValue,
          transformValue,
          transformOnBlur,
          onSelectItem,
          onUnitSelected,
          onCategorySelected,
          onStorageLocationSelected,
          onAddNewLocation,
          storageLocations,
          testID,
          key,
        }) => (
          <React.Fragment key={key}>
            <Controller
              control={control}
              name={name}
              render={({ field: { onChange, onBlur, value } }) => {
                // Custom onChange handler that transforms value if needed
                const handleChange = (newValue: any) => {
                  const transformedValue =
                    transformValue && !transformOnBlur
                      ? transformValue(newValue)
                      : newValue;
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

                // Handle value rendering (e.g., for tags array)
                const displayValue = renderValue ? renderValue(value) : value;

                // Handle autocomplete components by string identifier
                if (Input === 'itemAutocomplete') {
                  return (
                    <MemoizedItemAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      required={props?.required}
                      error={errors[name]?.message?.toString()}
                      onSelectItem={onSelectItem}
                      testID={testID}
                      {...props}
                    />
                  );
                }

                if (Input === 'brandAutocomplete') {
                  return (
                    <MemoizedBrandAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      required={props?.required}
                      error={errors[name]?.message?.toString()}
                      {...props}
                    />
                  );
                }

                if (Input === 'unitAutocomplete') {
                  return (
                    <MemoizedUnitsAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      onUnitSelected={onUnitSelected}
                      testID={testID}
                      {...props}
                    />
                  );
                }

                if (Input === 'categoryAutocomplete') {
                  return (
                    <MemoizedCategoryAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      required={props?.required}
                      error={errors[name]?.message?.toString()}
                      onCategorySelected={onCategorySelected}
                      {...props}
                    />
                  );
                }

                if (Input === 'storageLocationAutocomplete') {
                  return (
                    <MemoizedStorageLocationAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      required={props?.required}
                      error={errors[name]?.message?.toString()}
                      storageLocations={storageLocations || []}
                      onStorageLocationSelected={onStorageLocationSelected}
                      onAddNewLocation={onAddNewLocation}
                      {...props}
                    />
                  );
                }

                // Handle regular components
                if (Input && typeof Input !== 'string') {
                  // Check if it's a component that takes no props (render function)
                  const isRenderFunction =
                    typeof Input === 'function' &&
                    Input.length === 0 &&
                    !props?.componentType;

                  if (isRenderFunction) {
                    // Render as a component
                    return <Input />;
                  }

                  // Handle different input types and their specific props
                  const inputProps: any = {
                    label,
                    ...(placeholder && { placeholder }),
                    ...(testID && { testID }),
                    ...props,
                  };

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
                }

                // If no component provided, return empty fragment
                return <></>;
              }}
            />
            {errors[name] &&
              props?.componentType !== 'checkbox' &&
              Input !== FormInput &&
              Input !== 'itemAutocomplete' &&
              Input !== 'brandAutocomplete' &&
              Input !== 'unitAutocomplete' &&
              Input !== 'categoryAutocomplete' && (
                <Text
                  style={styles.errorText}
                  testID={
                    (props?.testID || testID)
                      ? `${props?.testID || testID}-error`
                      : undefined
                  }
                >
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
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
  },
}));
