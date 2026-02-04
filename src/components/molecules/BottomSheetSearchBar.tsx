import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import { View, TouchableOpacity } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconLibrary } from '#utils/iconUtils';

export interface BottomSheetSearchBarAction {
  icon: string;
  onPress: () => void;
  color?: string;
  library?: IconLibrary;
  testID?: string;
}

export interface BottomSheetSearchBarProps {
  placeholder?: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  rightActions?: BottomSheetSearchBarAction[];
  debounceMs?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  testID?: string;
  /** Initial value to pre-populate the search input */
  initialValue?: string;
}

export interface BottomSheetSearchBarRef {
  clear: () => void;
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

/**
 * BottomSheetSearchBar - Search bar designed for bottom sheets
 *
 * Features:
 * - Uses BottomSheetTextInput for proper keyboard handling in bottom sheets
 * - Uncontrolled input with refs to prevent cursor jumping issues
 * - Built-in debouncing for search queries
 * - Clear button when text is present
 * - Optional right action buttons (e.g., scan barcode)
 * - Exposes ref for programmatic control (clear, focus, blur, getValue)
 */
export const BottomSheetSearchBar = forwardRef<
  BottomSheetSearchBarRef,
  BottomSheetSearchBarProps
>(
  (
    {
      placeholder = 'Search...',
      onChangeText,
      onClear,
      rightActions,
      debounceMs = 250,
      autoCapitalize = 'words',
      autoCorrect = false,
      returnKeyType = 'search',
      testID,
      initialValue,
    },
    ref,
  ) => {
    const { theme } = useUnistyles();

    // Internal refs for uncontrolled input (fixes cursor jumping)
    const inputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
    const inputValueRef = useRef('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Track if we have text (for showing clear button)
    const [hasText, setHasText] = React.useState(false);

    // Helper to set input value programmatically
    const setInputValue = useCallback((value: string) => {
      inputValueRef.current = value;
      setHasText(value.length > 0);
      // Use setNativeProps for uncontrolled input
      if (inputRef.current) {
        (inputRef.current as any).setNativeProps?.({ text: value });
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      clear: () => {
        inputRef.current?.clear();
        inputValueRef.current = '';
        setHasText(false);
        onClear?.();
      },
      focus: () => {
        inputRef.current?.focus();
      },
      blur: () => {
        inputRef.current?.blur();
      },
      getValue: () => inputValueRef.current,
      setValue: setInputValue,
    }), [setInputValue, onClear]);

    // Set initial value when provided
    useEffect(() => {
      if (initialValue !== undefined && initialValue !== inputValueRef.current) {
        setInputValue(initialValue);
        // Notify parent of initial value (without debounce)
        onChangeText(initialValue);
      }
    }, [initialValue, setInputValue, onChangeText]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    // Debounced change handler - prevents cursor jumping
    const handleChangeText = useCallback(
      (text: string) => {
        // Store value immediately in ref
        inputValueRef.current = text;
        setHasText(text.length > 0);

        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Notify parent after debounce
        debounceTimerRef.current = setTimeout(() => {
          onChangeText(text);
        }, debounceMs);
      },
      [onChangeText, debounceMs],
    );

    // Handle clear button press
    const handleClear = useCallback(() => {
      inputRef.current?.clear();
      inputValueRef.current = '';
      setHasText(false);

      // Clear debounce and notify immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onChangeText('');
      onClear?.();
    }, [onChangeText, onClear]);

    return (
      <View style={styles.container}>
        <Icon
          name="search"
          size={20}
          color={theme.colors.textSecondary}
          library="MaterialIcons"
        />
        <BottomSheetTextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          onChangeText={handleChangeText}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          testID={testID}
        />
        {hasText && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="close"
              size={20}
              color={theme.colors.textSecondary}
              library="MaterialIcons"
            />
          </TouchableOpacity>
        )}
        {rightActions?.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionButton}
            onPress={action.onPress}
            testID={action.testID}
          >
            <Icon
              name={action.icon}
              size={24}
              color={action.color || theme.colors.primary}
              library={action.library || 'MaterialIcons'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  },
);

BottomSheetSearchBar.displayName = 'BottomSheetSearchBar';

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  actionButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
}));
