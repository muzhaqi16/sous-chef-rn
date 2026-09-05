import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, ScrollView, type LayoutChangeEvent } from 'react-native';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
// Themed wrapper, not gorhom's raw `BottomSheetTextInput`: the raw one sets no
// `placeholderTextColor` and falls back to the OS default, ignoring the theme.
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Label } from '#components/atoms/Label';
import { Text } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';

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

  // Renders a spacer of the list's height while open. The list is absolutely
  // positioned, so it adds nothing to the height its parent measures — in an
  // `enableDynamicSizing` sheet it otherwise opens past the sheet's bottom edge,
  // into the keyboard. Off by default: a fixed-height container has the room.
  reserveDropdownSpace?: boolean;
}

// Presentation only — anti-flicker lives upstream in `useAutocompleteSearch`.
//
// Stacking contract: the suggestion list is an absolutely-positioned overlay and
// RN `zIndex` orders SIBLINGS only, so every level up to the overlap needs an
// explicit descending zIndex on a `collapsable={false}` view. Wrap stacked form
// rows in `DropdownStack`, which applies both; never hand-roll a zIndex chain.
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
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  // Starts at the list's maximum so the first frame reserves too much rather than
  // too little — settling down reads better than growing into place.
  const [dropdownHeight, setDropdownHeight] = useState(
    DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP,
  );
  const [hasMeasuredDropdown, setHasMeasuredDropdown] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const slicedItems = items.slice(0, maxResults);

  const hasSearchQuery = searchTerm.length >= minSearchLength;
  const hasData = slicedItems.length > 0 || (hasSearchQuery && !loading);
  const shouldShowDropdown = showDropdown && hasSearchQuery && hasData;
  // `shouldShowDropdown` is also true for a settled search that matched NOTHING,
  // so one condition drives both the list and its reserved space — the space can
  // never be held open for a list that isn't there.
  const isDropdownOpen =
    shouldShowDropdown && (slicedItems.length > 0 || !!footerComponent);

  // The list goes momentarily empty mid-search — a debounce running, a page in
  // flight — and the reserved space is held across that. Releasing it would step
  // a sheet sized to its own content down and back up on every keystroke.
  const isReservingSpace =
    isDropdownOpen || (showDropdown && hasSearchQuery && loading);

  // Forget the height when the session ends, or reopening with fewer results
  // reserves the taller list's space until `onLayout` corrects it. Adjusted
  // during render so the reset lands in the commit that closed the dropdown.
  const [wasReservingSpace, setWasReservingSpace] = useState(isReservingSpace);
  if (isReservingSpace !== wasReservingSpace) {
    setWasReservingSpace(isReservingSpace);
    if (!isReservingSpace) {
      setDropdownHeight(DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP);
      setHasMeasuredDropdown(false);
    }
  }

  // Within one session the reserve only GROWS: a result set that shrinks as the
  // term narrows must not shrink the host with it. The first measurement is the
  // exception — it replaces the deliberately-too-tall placeholder outright.
  const handleDropdownLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height + DROPDOWN_GAP;
    setHasMeasuredDropdown(true);
    setDropdownHeight(prev =>
      hasMeasuredDropdown ? Math.max(prev, measured) : measured,
    );
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSearchTerm(value);
  }

  // The debounced notify fires up to `debounceMs` after the keystroke, by which
  // time the parent may have rebuilt `onChangeText` around newer state, so always
  // call the latest one. It must be a LAYOUT effect: a passive one flushes in a
  // separate task, and an already-due debounce timer can run in that gap and read
  // the stale callback this ref exists to avoid.
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
          <Text role="caption" tone="error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        {!!isDropdownOpen && (
          <View
            style={styles.suggestionsContainer}
            onLayout={reserveDropdownSpace ? handleDropdownLayout : undefined}
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
                  {index < slicedItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {footerComponent}
            </ScrollView>
          </View>
        )}
      </View>
      {/* A sibling, not a child: the list is anchored at `top: '100%'`, so a
          spacer inside would push it down instead of making room. That is also
          why it needs an explicit zIndex and `collapsable={false}` — it covers
          exactly the dropdown's region, and at the default it swallows every
          suggestion tap. Android-only, invisible to typecheck/lint/jest. */}
      {!!isReservingSpace && !!reserveDropdownSpace && (
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
    zIndex: theme.zIndex.elevated,
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
    ...theme.type.body,
    paddingHorizontal: theme.spacing.sm,
    paddingRight: theme.spacing.xl, // Space for loading indicator
    backgroundColor: theme.colors.inputBackground,
    borderWidth: theme.borderWidth.hairline,
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
    // Below the container's own step so the dropdown paints over it, and
    // non-zero so Android's view flattening cannot prune the ordering.
    zIndex: theme.zIndex.raised,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
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

  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
