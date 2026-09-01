import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import { View } from 'react-native';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
  type ThemedBottomSheetTextInputRef,
} from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
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
  initialValue?: string;
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
 * Search bar for bottom sheets. The input is UNCONTROLLED and driven through
 * refs — a controlled one jumps the cursor while the debounce is in flight.
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
    const inputRef = useRef<ThemedBottomSheetTextInputRef>(null);
    const inputValueRef = useRef('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [hasText, setHasText] = React.useState(false);

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

    const [prevInitialValue, setPrevInitialValue] =
      React.useState(initialValue);
    if (initialValue !== prevInitialValue) {
      setPrevInitialValue(initialValue);
      if (initialValue !== undefined) {
        setHasText(initialValue.length > 0);
      }
    }

    useEffect(() => {
      if (
        initialValue !== undefined &&
        initialValue !== inputValueRef.current
      ) {
        inputValueRef.current = initialValue;
        if (inputRef.current) {
          inputRef.current.setNativeProps?.({ text: initialValue });
        }
        onChangeText(initialValue);
      }
    }, [initialValue, onChangeText]);

    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    const handleChangeText = (text: string) => {
      inputValueRef.current = text;
      setHasText(text.length > 0);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onChangeText(text);
      }, debounceMs);
    };

    const handleClear = () => {
      inputRef.current?.clear();
      inputValueRef.current = '';
      setHasText(false);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onChangeText('');
      onClear?.();
    };

    return (
      <View style={styles.container}>
        <Icon name="search" size={20} tone="textSecondary" />
        <ThemedBottomSheetTextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          onChangeText={handleChangeText}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          testID={testID}
        />
        {!!isLoading && (
          <ThemedActivityIndicator
            size="small"
            style={styles.loadingIndicator}
          />
        )}
        {!!hasText && (
          <AppPressable
            style={styles.clearButton}
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={20} tone="textSecondary" />
          </AppPressable>
        )}
        {rightActions?.map((action, index) => (
          <AppPressable
            key={index}
            style={styles.actionButton}
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
          </AppPressable>
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
    borderCurve: 'continuous',
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
