import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
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
  /** Show loading indicator in search bar */
  isLoading?: boolean;
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
      isLoading = false,
    },
    ref,
  ) => {
    const { theme } = useUnistyles();

    // Internal refs for uncontrolled input (fixes cursor jumping)
    const inputRef =
      useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
    const inputValueRef = useRef('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Track if we have text (for showing clear button)
    const [hasText, setHasText] = React.useState(false);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
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
        setValue: (value: string) => {
          inputValueRef.current = value;
          setHasText(value.length > 0);
          if (inputRef.current) {
            inputRef.current.setNativeProps?.({ text: value });
          }
        },
      }),
      [onClear],
    );

    // Set hasText when initialValue changes (render-time state update)
    const [prevInitialValue, setPrevInitialValue] =
      React.useState(initialValue);
    if (initialValue !== prevInitialValue) {
      setPrevInitialValue(initialValue);
      if (initialValue !== undefined) {
        setHasText(initialValue.length > 0);
      }
    }

    // Apply native props, sync ref, and notify parent when initialValue changes
    useEffect(() => {
      if (
        initialValue !== undefined &&
        initialValue !== inputValueRef.current
      ) {
        inputValueRef.current = initialValue;
        if (inputRef.current) {
          inputRef.current.setNativeProps?.({ text: initialValue });
        }
        // Notify parent of initial value (without debounce)
        onChangeText(initialValue);
      }
    }, [initialValue, onChangeText]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    // Debounced change handler - prevents cursor jumping
    const handleChangeText = (text: string) => {
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
    };

    // Handle clear button press
    const handleClear = () => {
      inputRef.current?.clear();
      inputValueRef.current = '';
      setHasText(false);

      // Clear debounce and notify immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onChangeText('');
      onClear?.();
    };

    return (
      <View style={styles.container}>
        <Icon name="search" size={20} tone="textSecondary" />
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
        {!!isLoading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.loadingIndicator}
          />
        )}
        {!!hasText && (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.pressed,
            ]}
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={20} tone="textSecondary" />
          </Pressable>
        )}
        {rightActions?.map((action, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
            ]}
            onPress={action.onPress}
            testID={action.testID}
          >
            <Icon
              name={action.icon}
              size={24}
              color={action.color}
              tone="primary"
              library={action.library || 'Ionicons'}
            />
          </Pressable>
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
  loadingIndicator: {
    marginRight: theme.spacing.xs,
  },
  actionButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
