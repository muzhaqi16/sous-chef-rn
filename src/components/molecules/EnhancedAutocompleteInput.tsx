import React, {useState, useRef, useCallback} from 'react';
import {View, Text} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import {StyleSheet} from 'react-native-unistyles';
import {Input} from '#components/base/Input';
import EnhancedAutocomplete from '#components/molecules/EnhancedAutocomplete';
import {ItemSuggestion} from '#generated';

interface EnhancedAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  onSelectItem?: (item: ItemSuggestion) => void;
  error?: string;
}

export const EnhancedAutocompleteInput: React.FC<EnhancedAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  autoFocus,
  onSelectItem,
  error,
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleTextChange = (text: string) => {
    onChangeText(text);

    if (text.length >= 2 && !showAutocomplete) {
      setShowAutocomplete(true);
      setSearchTerm(text);
      bottomSheetRef.current?.present();
    } else if (text.length < 2 && showAutocomplete) {
      setShowAutocomplete(false);
      bottomSheetRef.current?.dismiss();
    } else if (text.length >= 2) {
      setSearchTerm(text);
    }
  };

  const handleBottomSheetTextChange = (text: string) => {
    setSearchTerm(text);
    onChangeText(text);
  };

  const handleSelectItem = (item: ItemSuggestion) => {
    onChangeText(item.name);
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
    onSelectItem?.(item);
  };

  const handleDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

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

  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        error={error}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['75%', '100%']}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize">
        <View style={styles.autocompleteContainer}>
          <Text style={styles.autocompleteTitle}>Search for an item</Text>

          <BottomSheetTextInput
            style={styles.bottomSheetInput}
            value={searchTerm}
            onChangeText={handleBottomSheetTextChange}
            placeholder="Type to search items..."
            autoFocus={true}
            returnKeyType="search"
          />

          <EnhancedAutocomplete
            searchTerm={searchTerm}
            onSelectItem={handleSelectItem}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  autocompleteContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
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
}));