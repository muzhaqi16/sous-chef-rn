import React from 'react';
import type { FieldRendererRegistry } from '#components/molecules/fieldRenderers';
import { ItemAutocompleteField } from './autocomplete/ItemAutocompleteField';
import { BrandAutocompleteField } from './autocomplete/BrandAutocompleteField';
import { UnitAutocompleteField } from './autocomplete/UnitAutocompleteField';
import { CategoryAutocompleteField } from './autocomplete/CategoryAutocompleteField';
import { StorageLocationAutocompleteField } from './autocomplete/StorageLocationAutocompleteField';
import { StoreAutocompleteField } from './autocomplete/StoreAutocompleteField';

/**
 * The catalog's named form fields, for `DynamicFormFields`.
 *
 * A `FieldDef` names one of these as a string (`component: 'brandAutocomplete'`)
 * and the form looks it up here. That indirection is what keeps the grocery
 * catalog out of the kit: the form renders whatever the app registered, and an
 * app without a grocery catalog registers something else.
 *
 * Field-specific callbacks (`onSelectItem`, `onUnitSelected`, …) arrive in
 * `props` and spread through untouched.
 */
export const catalogFieldRenderers: FieldRendererRegistry = {
  itemAutocomplete: {
    ownsErrorDisplay: true,
    render: ({
      label,
      value,
      onChangeText,
      placeholder,
      required,
      error,
      testID,
      props,
    }) => (
      <ItemAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        {...props}
      />
    ),
  },
  brandAutocomplete: {
    ownsErrorDisplay: true,
    render: ({
      label,
      value,
      onChangeText,
      placeholder,
      required,
      error,
      props,
    }) => (
      <BrandAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        {...props}
      />
    ),
  },
  unitAutocomplete: {
    ownsErrorDisplay: true,
    render: ({ label, value, onChangeText, placeholder, testID, props }) => (
      <UnitAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        testID={testID}
        {...props}
      />
    ),
  },
  categoryAutocomplete: {
    ownsErrorDisplay: true,
    render: ({
      label,
      value,
      onChangeText,
      placeholder,
      required,
      error,
      props,
    }) => (
      <CategoryAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        {...props}
      />
    ),
  },
  // No `ownsErrorDisplay`: this one has always let `DynamicFormFields` print a
  // second error line beneath it, unlike its five siblings. Preserved as-is —
  // it is a presentation question for whoever owns this field, and changing it
  // here would be an unrelated visual change.
  storageLocationAutocomplete: {
    render: ({
      label,
      value,
      onChangeText,
      placeholder,
      required,
      error,
      props,
    }) => (
      <StorageLocationAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        storageLocations={[]}
        {...props}
      />
    ),
  },
  storeAutocomplete: {
    ownsErrorDisplay: true,
    render: ({
      label,
      value,
      onChangeText,
      placeholder,
      required,
      error,
      props,
    }) => (
      <StoreAutocompleteField
        variant="modal"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        {...props}
      />
    ),
  },
};
