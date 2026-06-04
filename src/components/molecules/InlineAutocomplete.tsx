import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';

export interface InlineAutocompleteProps<T> {
  // Core
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;

  // Data
  items: T[];
  loading?: boolean;

  // Config
  minSearchLength?: number;
  debounceMs?: number;
  maxResults?: number;

  // Rendering
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  onSelect: (item: T) => void;

  // Footer
  footerComponent?: React.ReactNode;

  // Input
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/**
 * InlineAutocomplete - Generic autocomplete component for bottom sheets.
 *
 * Anti-flicker is handled upstream by useAutocompleteSearch — this component
 * receives stable, pre-processed items and focuses on presentation only.
 */
export function InlineAutocomplete<T>({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  items,
  loading = false,
  minSearchLength = 1,
  debounceMs = 250,
  maxResults = 6,
  renderItem,
  keyExtractor,
  onSelect,
  footerComponent,
  autoCapitalize = 'none',
}: InlineAutocompleteProps<T>) {
  // Track internal search term for visibility logic
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);

  // Ref-backed value tracking to prevent cursor jumping
  const inputValueRef = useRef(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Items sliced to max results
  const slicedItems = items.slice(0, maxResults);

  // Smart visibility logic
  const hasSearchQuery = searchTerm.length >= minSearchLength;
  const hasData = slicedItems.length > 0 || (hasSearchQuery && !loading);
  const shouldShowDropdown = showDropdown && hasSearchQuery && hasData;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync local state when value prop changes externally (render-time state update)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSearchTerm(value);
  }

  // Keep ref in sync with value prop
  useEffect(() => {
    inputValueRef.current = value;
  }, [value]);

  const handleTextChange = (text: string) => {
    // Store value immediately in ref
    inputValueRef.current = text;
    setSearchTerm(text);
    setShowDropdown(true);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Notify parent after debounce
    debounceTimerRef.current = setTimeout(() => {
      onChangeText(text);
      debounceTimerRef.current = null;
    }, debounceMs);
  };

  const handleSelect = (item: T) => {
    setShowDropdown(false);

    // Clear pending debounce so value sync effect works immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    onSelect(item);
  };

  const handleBlur = () => {
    // Delay hiding to allow tap on suggestion
    setTimeout(() => setShowDropdown(false), 200);
  };

  const handleFocus = () => {
    if (searchTerm.length >= minSearchLength && slicedItems.length > 0) {
      setShowDropdown(true);
    }
  };

  styles.useVariants({ error: !!error });

  return (
    <View style={styles.container}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={styles.inputContainer}>
        <BottomSheetTextInput
          style={styles.input}
          value={searchTerm}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          onBlur={handleBlur}
          onFocus={handleFocus}
          autoCapitalize={autoCapitalize}
          testID={testID}
        />
        {!!loading && !!hasSearchQuery && (
          <ThemedActivityIndicator
            size="small"
            style={styles.loadingIndicator}
          />
        )}
      </View>
      {error ? (
        <Text size="sm" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      {!!shouldShowDropdown &&
        !!(slicedItems.length > 0 || footerComponent) && (
          <View style={styles.suggestionsContainer}>
            <ScrollView
              style={styles.scrollView}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {slicedItems.map((item, index) => (
                <React.Fragment key={keyExtractor(item)}>
                  <AppPressable
                    onPress={() => handleSelect(item)}
                    style={styles.suggestion}
                  >
                    {renderItem(item, index)}
                  </AppPressable>
                  {index < slicedItems.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </React.Fragment>
              ))}
              {footerComponent}
            </ScrollView>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    height: theme.sizes.input.md,
    borderRadius: theme.radii.md,
    fontSize: theme.fonts.size.md,
    paddingHorizontal: theme.spacing.sm,
    paddingRight: theme.spacing.xl, // Space for loading indicator
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
    variants: {
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
  loadingIndicator: {
    position: 'absolute',
    right: theme.spacing.sm,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    maxHeight: 220,
    zIndex: theme.zIndex.dropdown,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  scrollView: {
    flex: 1,
  },
  suggestion: {},
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
