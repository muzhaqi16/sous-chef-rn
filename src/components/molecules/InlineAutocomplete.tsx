import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
// Themed wrapper rather than gorhom's raw `BottomSheetTextInput`: the raw one
// sets no `placeholderTextColor`, so it fell back to the OS default and ignored
// the app theme entirely (visibly wrong against the dark theme).
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';

/** Tallest the suggestion list is allowed to get; mirrored in `suggestionsContainer`. */
const DROPDOWN_MAX_HEIGHT = 220;
/** The list's offset below the input; mirrored from `suggestionsContainer.marginTop`. */
const DROPDOWN_GAP = 4;

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

  /**
   * Reserve in-flow space for the open dropdown.
   *
   * The suggestion list is absolutely positioned, so it adds nothing to the
   * height its parent measures. In a sheet sized to its own content
   * (`enableDynamicSizing`) that means the list opens past the sheet's bottom
   * edge — and with the keyboard up, straight into the keyboard. Setting this
   * renders a spacer of the list's height beneath the input while it is open,
   * so the measured content grows and the sheet grows with it.
   *
   * Off by default: in a fixed-height container the surrounding layout already
   * has the room, and a spacer there would just push the following fields down.
   */
  reserveDropdownSpace?: boolean;
}

/**
 * InlineAutocomplete - Generic autocomplete component for bottom sheets.
 *
 * Anti-flicker is handled upstream by useAutocompleteSearch — this component
 * receives stable, pre-processed items and focuses on presentation only.
 *
 * **Stacking contract:** the suggestion list is an absolutely-positioned
 * overlay, and RN `zIndex` only orders siblings — so every sibling this
 * dropdown can overlap, at every ancestor level up to where the overlap
 * happens, needs an explicit non-zero zIndex (descending top-to-bottom) on a
 * `collapsable={false}` view. Wrap vertically stacked form rows in
 * `DropdownStack` (`#components/atoms/DropdownStack`), which applies both
 * automatically — do not hand-roll zIndex chains. Miss a level and the
 * dropdown paints UNDER the inputs below it (Android view flattening can also
 * silently discard a layout-only wrapper's zIndex).
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
  reserveDropdownSpace = false,
}: InlineAutocompleteProps<T>) {
  // Track internal search term for visibility logic
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  // Space the open dropdown needs — its measured height plus the gap above it.
  // Starts at the list's own maximum so the first frame reserves too much
  // rather than too little: settling down into place reads better than growing
  // into it.
  const [dropdownHeight, setDropdownHeight] = useState(
    DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP,
  );

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Items sliced to max results
  const slicedItems = items.slice(0, maxResults);

  // Smart visibility logic
  const hasSearchQuery = searchTerm.length >= minSearchLength;
  const hasData = slicedItems.length > 0 || (hasSearchQuery && !loading);
  const shouldShowDropdown = showDropdown && hasSearchQuery && hasData;
  // `shouldShowDropdown` is true for a settled search that matched NOTHING
  // (`hasData` counts "done looking" as data), and with no footer there is then
  // nothing to render. One condition for the list and the reserved space, so
  // the space can never be held open for a list that is not there.
  const isDropdownOpen =
    shouldShowDropdown && (slicedItems.length > 0 || !!footerComponent);

  // Forget the last list's height when the dropdown closes, so reopening with
  // fewer results does not reserve the taller list's space until `onLayout`
  // corrects it. Adjusting state during render rather than in an effect keeps
  // the reset in the commit that closed the dropdown.
  const [wasDropdownOpen, setWasDropdownOpen] = useState(isDropdownOpen);
  if (isDropdownOpen !== wasDropdownOpen) {
    setWasDropdownOpen(isDropdownOpen);
    if (!isDropdownOpen) {
      setDropdownHeight(DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP);
    }
  }

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

  // The debounced notify below fires up to `debounceMs` AFTER the keystroke, by
  // which time the parent may have rebuilt `onChangeText` around newer state —
  // an entry list whose callback closes over its rows array is the common case.
  // Invoking the captured prop would map over the stale array and silently drop
  // whatever changed in between (e.g. a row added while the user was typing), so
  // always call the latest one.
  //
  // This has to be a LAYOUT effect: a passive effect is flushed in a separate
  // task after the commit, and an already-due debounce timer can run inside that
  // gap — reading the very stale callback this ref exists to avoid. Layout
  // effects run synchronously during the commit, so no timer can interleave.
  const onChangeTextRef = useRef(onChangeText);
  useLayoutEffect(() => {
    onChangeTextRef.current = onChangeText;
  });

  const handleTextChange = (text: string) => {
    setSearchTerm(text);
    setShowDropdown(true);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Notify parent after debounce
    debounceTimerRef.current = setTimeout(() => {
      onChangeTextRef.current(text);
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
    <>
      {/* collapsable={false}: this view carries the dropdown's own zIndex; if
          Android view flattening pruned it, the overlay would lose its stacking. */}
      <View style={styles.container} collapsable={false}>
        {label ? <Label required={required}>{label}</Label> : null}
        <View style={styles.inputContainer}>
          <ThemedBottomSheetTextInput
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
        {!!isDropdownOpen && (
          <View
            style={styles.suggestionsContainer}
            onLayout={
              reserveDropdownSpace
                ? event =>
                    setDropdownHeight(
                      event.nativeEvent.layout.height + DROPDOWN_GAP,
                    )
                : undefined
            }
          >
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
      {/* Sibling, not a child: the list is anchored at `top: '100%'` of the
          container above, so a spacer inside it would push the list down by
          its own height instead of making room for it.

          Being a sibling is also why it needs an explicit zIndex and
          `collapsable={false}`: it occupies exactly the region the dropdown
          paints into, and RN orders siblings by zIndex only — leaving this one
          at the default would put a transparent view over every suggestion,
          swallowing the taps. Android-only, and invisible to typecheck, lint
          and jest. */}
      {!!isDropdownOpen && !!reserveDropdownSpace && (
        <View
          collapsable={false}
          testID="dropdown-spacer"
          style={[styles.dropdownSpacer, { height: dropdownHeight }]}
        />
      )}
    </>
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
    borderCurve: 'continuous',
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
  dropdownSpacer: {
    // Below the container's own zIndex (10) so the dropdown paints over it,
    // and non-zero so Android's view flattening cannot prune the ordering.
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: DROPDOWN_GAP,
    maxHeight: DROPDOWN_MAX_HEIGHT,
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
