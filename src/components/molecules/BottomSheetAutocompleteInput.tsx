import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import { useAppStore } from '#store/useAppStore';
import { Icon } from '#utils/iconUtils';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

const AutocompleteSeparator = () => <View style={styles.separator} />;

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
  snapPoint = '70%',

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
  const userDismissedRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');

  const handleDismiss = () => {
    userDismissedRef.current = true; // Mark as user-dismissed
    hasInteractedRef.current = false; // Reset interaction flag to prevent auto-reopen
    setShowAutocomplete(false);
    onModalClose?.();
  };

  const {
    ref: bottomSheetRef,
    modalProps,
    theme,
  } = useStandardBottomSheet({
    onDismiss: handleDismiss,
    snapPoints: [snapPoint],
  });

  // Check online status to prevent autocomplete when offline
  const isOnline = useAppStore(state => state.isOnline);

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

  // Show modal only when we have results (search-first pattern)
  // Don't re-open if user explicitly dismissed (via selection or backdrop tap)
  // Only show if user has interacted with the field (prevents auto-open on form load)
  useEffect(() => {
    if (
      data.length > 0 &&
      searchTerm.length >= minSearchLength &&
      isOnline &&
      !showAutocomplete &&
      !userDismissedRef.current &&
      hasInteractedRef.current
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- must sync state with imperative present() and ref guards
      setShowAutocomplete(true);
      bottomSheetRef.current?.present();
      onModalOpen?.();
    }
  }, [
    data.length,
    searchTerm.length,
    minSearchLength,
    isOnline,
    showAutocomplete,
    onModalOpen,
    bottomSheetRef,
  ]);

  // Modal only closes via explicit user action:
  // - handleSelectItem (user selects an item)
  // - handleDismiss (user taps backdrop)
  // - handleSubmitCustomValue (user presses return/done)

  const handleTextChange = (text: string) => {
    hasInteractedRef.current = true; // User has interacted with the field
    userDismissedRef.current = false; // Clear flag - user is typing again
    onChangeText(text);
    setSearchTerm(text);
    // Modal visibility now controlled by data-based effects above
  };

  const handleBottomSheetTextChange = (text: string) => {
    setSearchTerm(text);
    onChangeText(text);
    onSearchChange?.(text);
  };

  const handleSelectItem = (item: T) => {
    userDismissedRef.current = true; // Mark as user-dismissed
    hasInteractedRef.current = false; // Reset interaction flag to prevent auto-reopen
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
    onSelectItem(item);
    onModalClose?.();
  };

  const handleSubmitCustomValue = () => {
    // Accept the current searchTerm as the custom value
    if (searchTerm.trim()) {
      onChangeText(searchTerm.trim());
    }
    // Dismiss the modal
    userDismissedRef.current = true; // Mark as user-dismissed
    hasInteractedRef.current = false; // Reset interaction flag to prevent auto-reopen
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
    onModalClose?.();
  };

  const defaultEmptyComponent = () => {
    // Show offline-specific message when not online
    if (!isOnline) {
      return (
        <BottomSheetView style={styles.messageContainer}>
          <Icon name="cloud-offline-outline" size={48} />
          <Text style={styles.emptyText}>Search unavailable offline</Text>
          <Text style={styles.emptySubtext}>
            You can still type a custom value and press done
          </Text>
        </BottomSheetView>
      );
    }

    return (
      <BottomSheetView style={styles.messageContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
        {emptySubtext ? (
          <Text style={styles.emptySubtext}>{emptySubtext}</Text>
        ) : null}
      </BottomSheetView>
    );
  };

  const renderAutocompleteItem = ({ item }: { item: T }) => (
    <Pressable
      onPress={() => handleSelectItem(item)}
      style={({ pressed }) => ({
        opacity: pressed ? theme.opacity.pressed : 1,
      })}
    >
      {renderItem(item)}
    </Pressable>
  );

  const defaultLoadingComponent = () => (
    <BottomSheetView style={styles.messageContainer}>
      <Text style={styles.loadingText}>Loading...</Text>
    </BottomSheetView>
  );

  return (
    <FormFieldWrapper label={label || ''} error={error} required={required}>
      <TextInput
        style={[styles.fieldInput, error && styles.fieldInputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        testID={testID}
        autoCapitalize={autoCapitalize}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        {...modalProps}
        keyboardBlurBehavior="none"
        enableContentPanningGesture={false}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <View style={styles.headerSection}>
            <Text style={styles.autocompleteTitle}>{title}</Text>

            <BottomSheetTextInput
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
          <BottomSheetFlatList
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderAutocompleteItem}
            ItemSeparatorComponent={AutocompleteSeparator}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Performance optimizations
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            initialNumToRender={10}
            updateCellsBatchingPeriod={50}
            ListFooterComponent={listFooterComponent}
            ListEmptyComponent={
              loading
                ? renderLoadingComponent?.() || defaultLoadingComponent()
                : renderEmptyComponent?.() || defaultEmptyComponent()
            }
          />
        </BottomSheetView>
      </BottomSheetModal>
    </FormFieldWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  fieldInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  fieldInputError: {
    borderColor: theme.colors.error,
  },
  headerSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  autocompleteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  bottomSheetInput: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.md,
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
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
}));
