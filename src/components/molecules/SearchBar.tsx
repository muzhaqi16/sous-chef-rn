import React, {
  forwardRef,
  type FC,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import type {
  ThemedBottomSheetTextInputRef,
  ThemedTextInputRef,
} from '#components/atoms/themedComponents';
import { CountBadge } from '#components/atoms/CountBadge';
import { Pressable } from '#components/atoms/themedComponents';
import { hitSlop } from '#/theme/foundations/sizes';
import { commonStyles } from '#/styles/commonStyles';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';
import { Icon, type IconName } from '#components/atoms/Icon';

export interface SearchBarAction {
  icon: IconName;
  onPress: () => void;
  /** A count over the icon, such as active filters; hidden at zero. */
  badge?: number;
  /** What the control does; its icon's name is no label. */
  accessibilityLabel: string;
  testID?: string;
  /** Its screen rect once laid out, for a spotlight tutorial to point at. */
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
   * CONTROLLED mode; omit it when passing `debounceMs`, where the field owns its
   * text: a controlled field re-renders per keystroke and its cursor jumps to
   * the end while the debounce is in flight.
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
  /**
   * The one control beside the field, which sorts or filters the list below.
   * Nothing else sits beside or inside a search field.
   */
  accessory?: SearchBarAction;
  /** Extra handler invoked when the clear (✕) button is tapped, in addition to
   * emptying the field. Use to also reset dependent state (e.g. cancel a search
   * and return to the default list). */
  onClear?: () => void;
};

/** The one control beside the field: a plain icon, its count badge over it. */
const SearchAccessory: FC<{ action: SearchBarAction }> = ({ action }) => {
  const { ref, measure } = useMeasuredRect(action.onButtonLayout);
  return (
    <View ref={ref} collapsable={false} onLayout={measure}>
      <Pressable
        onPress={action.onPress}
        hitSlop={hitSlop.lg}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        testID={action.testID}
        style={styles.accessory}
      >
        <View>
          <Icon name={action.icon} size="md" tone="primary" />
          <CountBadge count={action.badge} />
        </View>
      </Pressable>
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
      accessory,
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
        liveInput()?.setNativeProps({ text: next });
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
      liveInput()?.setNativeProps({ text: defaultValue });
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

    return (
      <View style={[styles.container, containerStyle]}>
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
          // Every search field shows it, so every one reads as the same field.
          leftIcon={<Icon name="search" size={16} tone="textTertiary" />}
          // A search names stores, brands and dishes no dictionary knows: iOS
          // turned "aldi" into "Adi". A caller may turn it back on.
          autoCorrect={false}
          {...textInputProps}
        />

        {accessory ? <SearchAccessory action={accessory} /> : null}
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
  // The icon's own width, so it ends on the gutter; `hitSlop` makes the 44pt.
  accessory: {
    marginLeft: theme.spacing.sm,
    minHeight: theme.sizes.touchTarget.md,
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
}));
