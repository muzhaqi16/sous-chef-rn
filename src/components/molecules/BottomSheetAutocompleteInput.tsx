import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { Header } from '#/components/molecules/Header';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedBottomSheetTextInput,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';
import { useIsOnline } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

const AutocompleteSeparator = () => <View style={styles.separator} />;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

interface BottomSheetAutocompleteInputProps<T> {
  // Input field props
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  testID?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';

  // Modal configuration
  title: string;
  searchPlaceholder: string;
  minSearchLength?: number;
  snapPoint?: string;

  // Data and rendering
  data: T[];
  loading?: boolean;
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  onSelectItem: (item: T) => void;

  // Empty state
  emptyText: string;
  emptySubtext?: string;
  renderEmptyComponent?: () => React.ReactElement;
  renderLoadingComponent?: () => React.ReactElement;

  // Footer
  listFooterComponent?: React.ReactElement | null;

  // Optional callbacks
  onSearchChange?: (searchTerm: string) => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export function BottomSheetAutocompleteInput<T>({
  // Input props
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  testID,
  autoCapitalize,

  // Modal props
  title,
  searchPlaceholder,
  minSearchLength = 2,
  // Taller than the hosts this picker is usually presented over — most sit at
  // 70% — so it reads as a separate surface stacked over one, rather than the
  // host redrawing itself. gorhom supports stacking (its own reference is the
  // Apple Maps clone), where the sheets are told apart by their heights.
  //
  // It cannot be taller than EVERY host: several reach 85-95%
  // (`CorrectWeightModal` expands to 85%, `MoveToPantryModal` and
  // `ManageRecipeSheet` to 95%). Over those, what distinguishes the picker is
  // the push animation and the backdrop dimming the host, not its height. Pass
  // `snapPoint` explicitly at such a call site if the stack needs to read more
  // clearly there — it is a prop precisely because one number cannot be right
  // for every host.
  snapPoint = '85%',

  // Data props
  data,
  loading = false,
  renderItem,
  keyExtractor,
  onSelectItem,

  // Empty state
  emptyText,
  emptySubtext,
  renderEmptyComponent,
  renderLoadingComponent,

  // Footer
  listFooterComponent,

  // Callbacks
  onSearchChange,
  onModalOpen,
  onModalClose,
}: BottomSheetAutocompleteInputProps<T>) {
  const { t } = useTranslation();
  // The trigger is a real, typeable field, so gorhom has to see it focus:
  // `BottomSheetTextInput` is what sets `animatedKeyboardState.target`, and
  // without a target gorhom caches the keyboard-shown event and discards it —
  // `keyboardBehavior` then never fires and the host sheet sits still while the
  // keyboard covers this field. It cannot be `BottomSheetTextInput`
  // unconditionally: that component reads the sheet's internal context, which
  // throws outside a sheet, and this field is also used on full screens.
  const InputComponent = useIsBottomSheetInput()
    ? ThemedBottomSheetTextInput
    : ThemedTextInput;
  const [userDismissed, setUserDismissed] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');

  const handleDismiss = () => {
    setUserDismissed(true);
    setHasInteracted(false);
    setShowAutocomplete(false);
    onModalClose?.();
  };

  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: showAutocomplete,
    onDismiss: handleDismiss,
    snapPoints: [snapPoint],
  });
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  // Check online status to prevent autocomplete when offline
  const isOnline = useIsOnline();

  // Sync searchTerm with external value changes only when modal is closed (render-time state update)
  // When modal is open, searchTerm is the source of truth to avoid cursor jumping
  const [prevValue, setPrevValue] = useState(value);
  const [prevShowAutocomplete, setPrevShowAutocomplete] =
    useState(showAutocomplete);
  if (value !== prevValue || showAutocomplete !== prevShowAutocomplete) {
    setPrevValue(value);
    setPrevShowAutocomplete(showAutocomplete);
    if (!showAutocomplete && value !== searchTerm) {
      setSearchTerm(value || '');
    }
  }

  // Auto-open when data arrives and conditions are met (render-time state adjustment)
  const shouldAutoOpen =
    data.length > 0 &&
    searchTerm.length >= minSearchLength &&
    isOnline &&
    !userDismissed &&
    hasInteracted;
  if (shouldAutoOpen && !showAutocomplete) {
    setShowAutocomplete(true);
  }

  // Call onModalOpen when showAutocomplete transitions to true (render-time state adjustment)
  const [prevShowAutoForCallback, setPrevShowAutoForCallback] = useState(false);
  if (showAutocomplete && !prevShowAutoForCallback) {
    onModalOpen?.();
  }
  if (showAutocomplete !== prevShowAutoForCallback) {
    setPrevShowAutoForCallback(showAutocomplete);
  }

  // Modal only closes via explicit user action:
  // - handleSelectItem (user selects an item)
  // - handleDismiss (user taps backdrop)
  // - handleSubmitCustomValue (user presses return/done)

  const handleTextChange = (text: string) => {
    setHasInteracted(true);
    setUserDismissed(false);
    onChangeText(text);
    setSearchTerm(text);
  };

  const handleBottomSheetTextChange = (text: string) => {
    setSearchTerm(text);
    onChangeText(text);
    onSearchChange?.(text);
  };

  // Every exit closes the picker the same way; only what happens BEFORE differs.
  const dismissPicker = () => {
    setUserDismissed(true);
    setHasInteracted(false);
    setShowAutocomplete(false);
    onModalClose?.();
  };

  const handleSelectItem = (item: T) => {
    onSelectItem(item);
    dismissPicker();
  };

  const handleSubmitCustomValue = () => {
    if (searchTerm.trim()) {
      onChangeText(searchTerm.trim());
    }
    dismissPicker();
  };

  // The header's close button. Nothing to commit: `handleBottomSheetTextChange`
  // already wrote every keystroke back through `onChangeText`, so the field
  // holds whatever was typed. Content panning is disabled on this sheet, so
  // without this button the only ways out are the backdrop and the return key.
  const handleClose = dismissPicker;

  const defaultEmptyComponent = () => {
    // Show offline-specific message when not online
    if (!isOnline) {
      return (
        <View style={styles.messageContainer}>
          <Icon name="cloud-offline-outline" size={48} />
          <Text
            size="base"
            weight="semibold"
            tone="secondary"
            style={styles.emptyText}
          >
            {t('autocomplete.offlineTitle')}
          </Text>
          <Text size="sm" tone="secondary" align="center">
            {t('autocomplete.offlineSubtitle')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.messageContainer}>
        <Text
          size="base"
          weight="semibold"
          tone="secondary"
          style={styles.emptyText}
        >
          {emptyText}
        </Text>
        {emptySubtext ? (
          <Text size="sm" tone="secondary" align="center">
            {emptySubtext}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderAutocompleteItem = ({
    item,
    index,
  }: {
    item: T;
    index: number;
  }) => (
    <Pressable
      // Index-keyed off the field's own testID, because the row's CONTENT is
      // per-field (a unit symbol, a brand name) and often translated.
      //
      // Selecting a suggestion is not the same action as typing the same text:
      // `onSelect` hands back the entity (`onUnitSelected(item.id, …)`), while
      // committing the text via the search field's return key only calls
      // `onChangeText`. Without a handle here a test could only do the latter,
      // so it exercised the free-text path and never the resolution one.
      testID={testID ? `${testID}-suggestion-${index}` : undefined}
      onPress={() => handleSelectItem(item)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {renderItem(item)}
    </Pressable>
  );

  const defaultLoadingComponent = () => (
    <View style={styles.messageContainer}>
      <Text size="base" tone="secondary">
        {t('loading.loading')}
      </Text>
    </View>
  );

  return (
    <FormFieldWrapper label={label || ''} error={error} required={required}>
      <InputComponent
        style={[styles.fieldInput, error && styles.fieldInputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        testID={testID}
        autoCapitalize={autoCapitalize}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        {...modalProps}
        // 'push' stacks this picker on top of a host sheet (e.g. the Add-item
        // sheet). The default 'switch' would minimize the host — it slides to
        // the closed position and the whole flow appears to dismiss.
        stackBehavior="push"
        keyboardBlurBehavior="none"
        enableContentPanningGesture={false}
      >
        {/* A plain View, deliberately not gorhom's `BottomSheetView`. That
            component is styled `position: 'absolute'` with `top/left/right`
            but no `bottom` (bottomSheetView/styles.ts in 5.2.14), so its
            height is its content's and a `flex: 1` on it does nothing — the
            FlashList below was never bounded, grew to every row, and could
            not scroll. The sheet's content region has an explicit animated
            height (BottomSheetContent.tsx), so a flex child IS bounded.
            `BottomSheetView` also re-registers the sheet's scrollable as a
            plain view after the FlashList registers itself, since a parent's
            effects run after its children's. It is meant for static content
            that the sheet sizes itself to, not as a wrapper around a list. */}
        <View style={styles.sheetBody}>
          <Header title={title} centerTitle onClose={handleClose} borderless />
          <View style={styles.headerSection}>
            <ThemedBottomSheetTextInput
              style={styles.bottomSheetInput}
              defaultValue={searchTerm}
              onChangeText={handleBottomSheetTextChange}
              placeholder={searchPlaceholder}
              autoFocus={showAutocomplete}
              returnKeyType="done"
              onSubmitEditing={handleSubmitCustomValue}
              testID={testID ? `${testID}-search` : undefined}
              autoCapitalize={autoCapitalize}
            />
          </View>
          <FlashList
            renderScrollComponent={BottomSheetScrollable}
            data={data}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            renderItem={renderAutocompleteItem}
            ItemSeparatorComponent={AutocompleteSeparator}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={listFooterComponent}
            ListEmptyComponent={
              loading
                ? renderLoadingComponent?.() || defaultLoadingComponent()
                : renderEmptyComponent?.() || defaultEmptyComponent()
            }
          />
        </View>
      </BottomSheetModal>
    </FormFieldWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  fieldInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  fieldInputError: {
    borderColor: theme.colors.error,
  },
  sheetBody: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  bottomSheetInput: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    fontSize: theme.typography.fontSize.base,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  messageContainer: {
    flex: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  emptyText: {
    marginBottom: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
