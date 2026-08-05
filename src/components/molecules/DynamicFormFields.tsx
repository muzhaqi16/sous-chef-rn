import React, { useRef } from 'react';
import { View, type TextInput } from 'react-native';
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
import { StoreAutocompleteField } from './AutocompleteField/StoreAutocompleteField';
import { FormInput } from './FormInput';
import { Text } from '#components/atoms/Text';
import type {
  ItemSuggestion,
  StorageLocation,
} from '#/graphql/generated/schemaTypes';

const MemoizedItemAutocomplete = ItemAutocompleteField;
const MemoizedBrandAutocomplete = BrandAutocompleteField;
const MemoizedUnitsAutocomplete = UnitAutocompleteField;
const MemoizedCategoryAutocomplete = CategoryAutocompleteField;
const MemoizedStorageLocationAutocomplete = StorageLocationAutocompleteField;
const MemoizedStoreAutocomplete = StoreAutocompleteField;

export type FieldDef<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  // Dynamic dispatch: the component is rendered with a prop bag assembled at
  // runtime (value/onChangeText/error/...). `React.ElementType` accepts any
  // component while keeping the JSX spread type-checkable without `any`.
  component?:
    | React.ElementType
    | 'itemAutocomplete'
    | 'brandAutocomplete'
    | 'unitAutocomplete'
    | 'categoryAutocomplete'
    | 'storageLocationAutocomplete'
    | 'storeAutocomplete';
  props?: Record<string, unknown>;
  // For select fields
  options?: Array<{ label: string; value: string }>;
  // For checkbox fields
  onValueChange?: (value: unknown) => void;
  // For custom rendering logic
  renderValue?: (value: unknown) => string;
  // For custom value transformation before validation
  transformValue?: (value: unknown) => unknown;
  // Transform only on blur, not on every keystroke
  transformOnBlur?: boolean;
  // Autocomplete specific props
  onSelectItem?: (item: ItemSuggestion) => void;
  onUnitSelected?: (unitId: string | null, unitName: string | null) => void;
  onCategorySelected?: (categoryId: string | null) => void;
  onStorageLocationSelected?: (
    locationId: string | null,
    location: StorageLocation | null,
  ) => void;
  onStoreSelected?: (storeId: string | null, storeName: string | null) => void;
  onAddNewLocation?: (name: string) => void;
  storageLocations?: StorageLocation[];
  testID?: string;
};

interface DynamicFormFieldsProps<T extends FieldValues> {
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
  /**
   * Turn the keyboard's return key into "next", moving focus down the field
   * list and leaving "done" on the last one. Off by default: it only suits
   * forms that are a plain top-to-bottom stack of text inputs, which the
   * pickers, checkboxes and autocompletes in the item/pantry forms are not.
   */
  focusChaining?: boolean;
}

export function DynamicFormFields<T extends FieldValues>({
  fields,
  control,
  errors,
  focusChaining = false,
}: DynamicFormFieldsProps<T>) {
  // Focus is only reachable imperatively in React Native, so moving between
  // fields needs a handle on each one. Populated by callback refs at commit,
  // read only from the return-key handler.
  const inputRefs = useRef<Array<TextInput | null>>([]);
  // Memoize the field components to prevent recreation
  const memoizedFields = (() => {
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
          onStoreSelected,
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
        onStoreSelected,
        onAddNewLocation,
        storageLocations,
        testID,
        key: `${String(name)}-${idx}`,
      }),
    );
  })();

  return (
    <View style={styles.container}>
      {memoizedFields.map(
        (
          {
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
            onStoreSelected,
            onAddNewLocation,
            storageLocations,
            testID,
            key,
          },
          index,
        ) => (
          <React.Fragment key={key}>
            <Controller
              control={control}
              name={name}
              render={({ field: { onChange, onBlur, value } }) => {
                // Custom onChange handler that transforms value if needed
                const handleChange = (newValue: unknown) => {
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
                      required={Boolean(props?.required)}
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
                      required={Boolean(props?.required)}
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
                      required={Boolean(props?.required)}
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
                      required={Boolean(props?.required)}
                      error={errors[name]?.message?.toString()}
                      storageLocations={storageLocations || []}
                      onStorageLocationSelected={onStorageLocationSelected}
                      onAddNewLocation={onAddNewLocation}
                      {...props}
                    />
                  );
                }

                if (Input === 'storeAutocomplete') {
                  return (
                    <MemoizedStoreAutocomplete
                      variant="modal"
                      label={label}
                      value={displayValue || ''}
                      onChangeText={handleChange}
                      placeholder={placeholder}
                      required={Boolean(props?.required)}
                      error={errors[name]?.message?.toString()}
                      onStoreSelected={onStoreSelected}
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

                  // Handle different input types and their specific props.
                  // Chaining goes in before `...props` so a field can still
                  // set its own returnKeyType or handler.
                  const isLastField = index === fields.length - 1;
                  const chainingProps: Record<string, unknown> =
                    focusChaining && !isLastField
                      ? {
                          returnKeyType: 'next',
                          // Hand focus straight over without letting the
                          // keyboard drop and re-open in between.
                          submitBehavior: 'submit',
                          onSubmitEditing: () => {
                            inputRefs.current[index + 1]?.focus();
                          },
                        }
                      : focusChaining
                      ? { returnKeyType: 'done' }
                      : {};

                  const inputProps: Record<string, unknown> = {
                    label,
                    ...(placeholder && { placeholder }),
                    ...(testID && { testID }),
                    ...(focusChaining && {
                      ref: (node: TextInput | null) => {
                        inputRefs.current[index] = node;
                      },
                    }),
                    ...chainingProps,
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
            {!!errors[name] &&
              props?.componentType !== 'checkbox' &&
              Input !== FormInput &&
              Input !== 'itemAutocomplete' &&
              Input !== 'brandAutocomplete' &&
              Input !== 'unitAutocomplete' &&
              Input !== 'categoryAutocomplete' &&
              Input !== 'storeAutocomplete' && (
                <Text
                  size="sm"
                  tone="error"
                  style={styles.errorText}
                  testID={
                    props?.testID || testID
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
  },
}));
