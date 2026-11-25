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
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import type { ThemedTextInputRef } from '#components/atoms/themedComponents';
import { CountBadge } from '#components/atoms/CountBadge';
import { Pressable } from '#components/atoms/themedComponents';
import { hitSlop } from '#theme/foundations/sizes';
import { commonStyles } from '#styles/commonStyles';
import { Icon, type IconName } from '#components/atoms/Icon';

export interface SearchBarAction {
  icon: IconName;
  onPress: () => void;
  /** A count over the icon, such as active filters; hidden at zero. */
  badge?: number;
  /** What the control does; its icon's name is no label. */
  accessibilityLabel: string;
  testID?: string;
}

/** The field's handle: it reaches the input inside a sheet or out. */
export interface SearchBarRef {
  clear: () => void;
  focus: () => void;
  blur: () => void;
  /** What the field shows, which a debounce may not have reported yet. */
  getValue: () => string;
}

type SearchBarProps = Omit<
  TextInputProps,
  'style' | 'value' | 'defaultValue'
> & {
  /**
   * The text to show: read when the field mounts, and again whenever it
   * changes to something the field did not report, as a reset from outside.
   * An echo of what was typed changes nothing.
   */
  value?: string;
  /** What was typed, after `debounceMs` of quiet; a clear reports at once. */
  onChangeText: (text: string) => void;
  /** Milliseconds of quiet before a change is reported; 0 reports each one. */
  debounceMs?: number;
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
const SearchAccessory: FC<{ action: SearchBarAction }> = ({ action }) => (
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
);

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      value,
      onChangeText,
      debounceMs = 0,
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

    const inputRef = useRef<ThemedTextInputRef>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [text, setText] = useState(value ?? '');
    // What the caller was last told, so its echo is not read as a reset.
    const [reported, setReported] = useState(value ?? '');
    const [seenValue, setSeenValue] = useState(value);
    if (value !== seenValue) {
      setSeenValue(value);
      if (value !== undefined && value !== reported) {
        setText(value);
        setReported(value);
      }
    }

    const report = (next: string) => {
      setReported(next);
      onChangeText(next);
    };

    const cancelPending = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    };

    useEffect(() => cancelPending, []);

    const handleChangeText = (next: string) => {
      setText(next);
      cancelPending();
      if (debounceMs <= 0) {
        report(next);
        return;
      }
      debounceTimer.current = setTimeout(() => report(next), debounceMs);
    };

    // Empties the field and the filter it drives, at once.
    const handleClear = () => {
      cancelPending();
      setText('');
      report('');
      onClear?.();
    };

    useImperativeHandle(searchRef, () => ({
      clear: handleClear,
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      getValue: () => text,
    }));

    return (
      <View style={[styles.container, containerStyle]}>
        <BaseInput
          value={text}
          ref={inputRef}
          onChangeText={handleChangeText}
          placeholder={resolvedPlaceholder}
          style={inputStyle}
          containerStyle={[styles.inputContainer, commonStyles.shadow]}
          showClearIcon={text.length > 0}
          isLoading={isLoading}
          onClear={handleClear}
          // Every search field shows it, so every one reads as the same field.
          leftIcon={<Icon name="search" size="xs" tone="textTertiary" />}
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
