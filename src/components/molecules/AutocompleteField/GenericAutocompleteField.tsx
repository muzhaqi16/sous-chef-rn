import React from 'react';
import { AutocompleteField } from './AutocompleteField';

export interface GenericAutocompleteFieldProps<T> {
  variant: 'inline' | 'modal';
  label?: string;
  value: string;
  /**
   * Called on every keystroke. Each field wires this to its hook's
   * search-term handler and clears any previous selection.
   */
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  items: T[];
  loading?: boolean;
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  onSelect: (item: T) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  // Inline-variant tuning.
  inlineMinSearchLength?: number;
  maxResults?: number;
  /** See `InlineAutocomplete`: for hosts sized to their own content. */
  reserveDropdownSpace?: boolean;
  // Modal-variant copy + tuning.
  modalTitle: string;
  modalSearchPlaceholder: string;
  modalEmptyText: string;
  modalEmptySubtext?: string;
  modalMinSearchLength?: number;
  onSearchChange?: (text: string) => void;
}

/**
 * Owns the inline/modal variant branch for every `*AutocompleteField` wrapper: a
 * wrapper supplies only its hook's items plus field-specific handlers and copy,
 * and this picks the matching discriminated-union shape for `AutocompleteField`.
 */
export function GenericAutocompleteField<T>({
  variant,
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  items,
  loading,
  renderItem,
  keyExtractor,
  onSelect,
  autoCapitalize,
  inlineMinSearchLength,
  maxResults,
  reserveDropdownSpace,
  modalTitle,
  modalSearchPlaceholder,
  modalEmptyText,
  modalEmptySubtext,
  modalMinSearchLength,
  onSearchChange,
}: GenericAutocompleteFieldProps<T>) {
  if (variant === 'inline') {
    return (
      <AutocompleteField<T>
        variant="inline"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        items={items}
        loading={loading}
        minSearchLength={inlineMinSearchLength}
        maxResults={maxResults}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onSelect={onSelect}
        autoCapitalize={autoCapitalize}
        reserveDropdownSpace={reserveDropdownSpace}
      />
    );
  }

  return (
    <AutocompleteField<T>
      variant="modal"
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      title={modalTitle}
      searchPlaceholder={modalSearchPlaceholder}
      items={items}
      loading={loading}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onSelect={onSelect}
      emptyText={modalEmptyText}
      emptySubtext={modalEmptySubtext}
      onSearchChange={onSearchChange}
      minSearchLength={modalMinSearchLength}
      autoCapitalize={autoCapitalize}
    />
  );
}
