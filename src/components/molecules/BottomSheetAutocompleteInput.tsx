import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Input } from '#components/base/Input';
import { useStore } from '#store';

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

  // Callbacks
  onSearchChange,
  onModalOpen,
  onModalClose,
}: BottomSheetAutocompleteInputProps<T>) {
  const { height } = useWindowDimensions();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const userDismissedRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');

  // Check online status to prevent autocomplete when offline
  const isOnline = useStore(state => state.isOnline);

  // Sync searchTerm with external value changes only when modal is closed
  // When modal is open, searchTerm is the source of truth to avoid cursor jumping
  useEffect(() => {
    if (!showAutocomplete && value !== searchTerm) {
      setSearchTerm(value || '');
    }
  }, [value, showAutocomplete]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowAutocomplete(true);
      bottomSheetRef.current?.present();
      onModalOpen?.();
    }
  }, [data.length, searchTerm.length, minSearchLength, isOnline, showAutocomplete, onModalOpen]);

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
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
    onSelectItem(item);
    onModalClose?.();
  };

  const handleDismiss = useCallback(() => {
    userDismissedRef.current = true; // Mark as user-dismissed
    setShowAutocomplete(false);
    onModalClose?.();
  }, [onModalClose]);

  const handleSubmitCustomValue = useCallback(() => {
    // Accept the current searchTerm as the custom value
    if (searchTerm.trim()) {
      onChangeText(searchTerm.trim());
    }
    // Dismiss the modal
    userDismissedRef.current = true; // Mark as user-dismissed
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
    onModalClose?.();
  }, [searchTerm, onChangeText, onModalClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        enableTouchThrough={false}
        onPress={() => bottomSheetRef.current?.dismiss()}
      />
    ),
    [],
  );

  const defaultEmptyComponent = () => (
    <BottomSheetView style={[styles.messageContainer, { minHeight: height * 0.5 }]}>
      <Text style={styles.emptyText}>{emptyText}</Text>
      {emptySubtext && (
        <Text style={styles.emptySubtext}>{emptySubtext}</Text>
      )}
    </BottomSheetView>
  );

  const defaultLoadingComponent = () => (
    <BottomSheetView style={[styles.messageContainer, { minHeight: height * 0.5 }]}>
      <Text style={styles.loadingText}>Loading...</Text>
    </BottomSheetView>
  );

  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
        testID={testID}
        autoCapitalize={autoCapitalize}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={[snapPoint]}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize"
        enablePanDownToClose={true}
        enableContentPanningGesture={false}
      >
        <BottomSheetFlatList
          data={loading ? [] : data}
          keyExtractor={keyExtractor}
          renderItem={({ item }: { item: T }) => {
            const element = renderItem(item);
            // Clone the element and override onPress to ensure bottom sheet closes
            return React.cloneElement(element as React.ReactElement<any>, {
              onPress: () => handleSelectItem(item),
            });
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          // Performance optimizations
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <Text style={styles.autocompleteTitle}>{title}</Text>

              <BottomSheetTextInput
                style={styles.bottomSheetInput}
                value={searchTerm}
                onChangeText={handleBottomSheetTextChange}
                placeholder={searchPlaceholder}
                autoFocus={showAutocomplete}
                returnKeyType="done"
                onSubmitEditing={handleSubmitCustomValue}
                testID={testID ? `${testID}-search` : undefined}
                autoCapitalize={autoCapitalize}
              />
            </View>
          }
          ListEmptyComponent={
            loading
              ? renderLoadingComponent?.() || defaultLoadingComponent()
              : renderEmptyComponent?.() || defaultEmptyComponent()
          }
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  headerSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
    flexGrow: 1,
  },
  autocompleteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
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
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
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
