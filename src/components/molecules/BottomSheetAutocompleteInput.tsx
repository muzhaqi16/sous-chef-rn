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
  // Taller than the ~70% hosts this is usually pushed over, so it reads as a
  // separate stacked surface. It cannot clear every host (several reach 85-95%),
  // hence the prop: override `snapPoint` at those call sites.
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
  // Only `BottomSheetTextInput` sets `animatedKeyboardState.target`; without it
  // gorhom discards the keyboard-shown event and the host sheet never moves out
  // from under the keyboard. It can't be unconditional — that component reads
  // the sheet context and throws on the full screens this field also serves.
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

  const isOnline = useIsOnline();

  // While the modal is open `searchTerm` is the source of truth, or the cursor jumps.
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

  const shouldAutoOpen =
    data.length > 0 &&
    searchTerm.length >= minSearchLength &&
    isOnline &&
    !userDismissed &&
    hasInteracted;
  if (shouldAutoOpen && !showAutocomplete) {
    setShowAutocomplete(true);
  }

  const [prevShowAutoForCallback, setPrevShowAutoForCallback] = useState(false);
  if (showAutocomplete && !prevShowAutoForCallback) {
    onModalOpen?.();
  }
  if (showAutocomplete !== prevShowAutoForCallback) {
    setPrevShowAutoForCallback(showAutocomplete);
  }

  // The modal closes only on explicit user action: select, backdrop tap, or return.

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

  // Nothing to commit — every keystroke already went back through `onChangeText`.
  // Content panning is off here, so without this button the only ways out are the
  // backdrop and the return key.
  const handleClose = dismissPicker;

  const defaultEmptyComponent = () => {
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
      // Index-keyed off the field's testID: row content is per-field and often
      // translated. Selecting a suggestion hands back the ENTITY, where committing
      // the same text via return only calls `onChangeText` — different paths.
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
        // 'push' stacks over a host sheet; the default 'switch' minimizes the
        // host, so the whole flow appears to dismiss.
        stackBehavior="push"
        keyboardBlurBehavior="none"
        enableContentPanningGesture={false}
      >
        {/* A plain View, NOT gorhom's `BottomSheetView`: that is absolutely
            positioned with no bottom, so `flex: 1` cannot bound the FlashList
            and it also re-registers the sheet's scrollable as a plain view
            after the list registers itself. It is for static content. */}
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
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
    borderWidth: theme.borderWidth.hairline,
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
