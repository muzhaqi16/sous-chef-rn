import React, {
  forwardRef,
  type FC,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  StyleSheet,
  useUnistyles,
  withUnistyles,
} from 'react-native-unistyles';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import type {
  ThemedBottomSheetTextInputRef,
  ThemedTextInputRef,
} from '#components/atoms/themedComponents';
import { ActionButton } from '#components/atoms/ActionButton';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';

export interface SearchBarAction {
  icon: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  badge?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  library?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  animated?: boolean;
  isHighlighted?: boolean;
  testID?: string; // Optional testID for E2E testing
  /** Callback with screen-coordinate rect when the button lays out (for spotlight tutorials) */
  onButtonLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

/**
 * Imperative surface for the DEBOUNCED mode, where the field is uncontrolled.
 */
export interface SearchBarRef {
  clear: () => void;
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

type SearchBarProps = Omit<TextInputProps, 'style'> & {
  /**
   * CONTROLLED mode. Omit it together with `debounceMs` for the debounced
   * mode, where the field owns its own text: a controlled field re-renders on
   * every keystroke and the cursor jumps to the end while the debounce is in
   * flight.
   */
  value?: string;
  onChangeText: (text: string) => void;
  /** Debounced (uncontrolled) mode: milliseconds to wait before reporting. */
  debounceMs?: number;
  /** Debounced mode: the text to seed and to re-seed on change. */
  defaultValue?: string;
  /** Shows a spinner in the field while a search is in flight. */
  isLoading?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  listName?: string;
  itemCount?: number;
  completedCount?: number;
  leftActions?: SearchBarAction[];
  rightActions?: SearchBarAction[];
  /** Show search icon inside the input field (left side) */
  showSearchIcon?: boolean;
  /** Custom icon/element to show inside the input field (right side, when not showing clear) */
  innerRightIcon?: ReactNode;
  /** Extra handler invoked when the clear (✕) button is tapped, in addition to
   * emptying the field. Use to also reset dependent state (e.g. cancel a search
   * and return to the default list). */
  onClear?: () => void;
};

const ThemedActionButton = withUnistyles(ActionButton);

/**
 * Wrapper that measures an action button's screen position for spotlight tutorials.
 * ActionButton has marginLeft which shifts the visual button right of the layout
 * origin. We measure the wrapper then trim the margin so the reported rect
 * matches only the visible button area.
 */
const MeasuredAction: FC<{
  onButtonLayout: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  children: ReactNode;
}> = ({ onButtonLayout, children }) => {
  const ref = useRef<View>(null);
  // Subscribe to theme changes so the reported rect stays in sync with the
  // density/spacing override applied by `useAppearance`. Reading
  // `theme.spacing.sm` here (a) makes the dependency explicit to the React
  // Compiler / Unistyles tracker and (b) gives us a stable closure value
  // for the effect that triggers a fresh measure when spacing shifts.
  const { theme } = useUnistyles();
  const margin = theme.spacing.sm;

  const handleLayout = () => {
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onButtonLayout({
            x: pageX + margin,
            y: pageY,
            width: w - margin,
            height: h,
          });
        }
      });
    });
  };

  // Force a re-measure whenever spacing changes — the inner button's
  // dimensions usually shift along with theme spacing and re-fire onLayout
  // naturally, but this guarantees the rect stays correct even when they
  // don't (e.g. high-contrast toggle that only changes colors).
  useEffect(() => {
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onButtonLayout({
            x: pageX + margin,
            y: pageY,
            width: w - margin,
            height: h,
          });
        }
      });
    });
  }, [margin, onButtonLayout]);

  return (
    <View ref={ref} collapsable={false} onLayout={handleLayout}>
      {children}
    </View>
  );
};

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      value,
      onChangeText,
      debounceMs,
      defaultValue,
      isLoading = false,
      placeholder,
      containerStyle,
      inputStyle,
      leftActions = [],
      rightActions = [],
      showSearchIcon = false,
      innerRightIcon,
      onClear,
      ...textInputProps
    },
    searchRef,
  ) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('searchBar.placeholder');

    const debounced = debounceMs !== undefined;
    // `BaseInput` renders gorhom's input inside a sheet and the plain one
    // outside, and routes a different ref to each. A debounced SearchBar is
    // uncontrolled, so a handle reaching neither cannot change what is shown.
    const sheetInputRef = useRef<ThemedBottomSheetTextInputRef>(null);
    const plainInputRef = useRef<ThemedTextInputRef>(null);
    const liveInput = () => sheetInputRef.current ?? plainInputRef.current;
    const textRef = useRef('');
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [hasText, setHasText] = useState(false);

    useImperativeHandle(searchRef, () => ({
      clear: () => {
        liveInput()?.clear();
        textRef.current = '';
        setHasText(false);
        onChangeText('');
        onClear?.();
      },
      focus: () => liveInput()?.focus(),
      blur: () => liveInput()?.blur(),
      getValue: () => textRef.current,
      setValue: (next: string) => {
        textRef.current = next;
        liveInput()?.setNativeProps?.({ text: next });
        setHasText(next.length > 0);
      },
    }));

    const [prevDefault, setPrevDefault] = useState(defaultValue);
    if (defaultValue !== prevDefault) {
      setPrevDefault(defaultValue);
      if (defaultValue !== undefined) setHasText(defaultValue.length > 0);
    }

    useEffect(() => {
      if (defaultValue === undefined || defaultValue === textRef.current)
        return;
      textRef.current = defaultValue;
      liveInput()?.setNativeProps?.({ text: defaultValue });
      onChangeText(defaultValue);
    }, [defaultValue, onChangeText]);

    useEffect(
      () => () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      },
      [],
    );

    const handleChangeText = (text: string) => {
      if (!debounced) {
        onChangeText(text);
        return;
      }
      textRef.current = text;
      setHasText(text.length > 0);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => onChangeText(text), debounceMs);
    };

    const handleClear = () => {
      if (debounced) {
        liveInput()?.clear();
        textRef.current = '';
        setHasText(false);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      }
      onChangeText('');
      onClear?.();
    };

    const renderActionButtons = (
      actions: SearchBarAction[],
      side: 'left' | 'right',
    ) => {
      if (actions.length === 0) return null;

      return (
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => {
            const key = `${side}-${index}-${action.icon}`;
            const fallbackLabel = t('searchBar.actionFallback', {
              icon: action.icon,
            });
            const button = (
              <ThemedActionButton
                key={key}
                name={action.icon}
                onPress={action.onPress}
                style={[commonStyles.shadow, action.style]}
                uniProps={theme => ({
                  color: action.color ?? theme.colors.onPrimary,
                  backgroundColor:
                    action.backgroundColor ?? theme.colors.primary,
                })}
                size={action.size}
                accessibilityLabel={action.accessibilityLabel || fallbackLabel}
                isHighlighted={action.animated ? action.isHighlighted : false}
                testID={action.testID}
              />
            );

            if (action.onButtonLayout) {
              return (
                <MeasuredAction
                  key={key}
                  onButtonLayout={action.onButtonLayout}
                >
                  {button}
                </MeasuredAction>
              );
            }

            return button;
          })}
        </View>
      );
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {renderActionButtons(leftActions, 'left')}

        <BaseInput
          value={debounced ? undefined : value}
          defaultValue={debounced ? defaultValue : undefined}
          ref={debounced ? plainInputRef : undefined}
          sheetRef={debounced ? sheetInputRef : undefined}
          onChangeText={handleChangeText}
          placeholder={resolvedPlaceholder}
          style={inputStyle}
          containerStyle={[styles.inputContainer, commonStyles.shadow]}
          showClearIcon={debounced ? hasText : true}
          isLoading={isLoading}
          onClear={handleClear}
          leftIcon={
            showSearchIcon ? (
              <Icon name="search" size={16} tone="textTertiary" />
            ) : undefined
          }
          rightIcon={!value ? innerRightIcon : undefined}
          {...textInputProps}
        />

        {renderActionButtons(rightActions, 'right')}
      </View>
    );
  },
);

SearchBar.displayName = 'SearchBar';

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
}));
