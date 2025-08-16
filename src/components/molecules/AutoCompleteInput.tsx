import React, {useState, useRef, useCallback} from 'react';
import {View, Text} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {Input} from '#components/base/Input';
import Autocomplete from '#components/molecules/AutoComplete';
import {ItemSuggestion} from '#generated';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  onSelectItem?: (item: ItemSuggestion) => void;
  error?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  autoFocus,
  onSelectItem,
  error,
}) => {
  const {styles, theme} = useStyles(stylesheet);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleTextChange = (text: string) => {
    onChangeText(text);

    // Show autocomplete if user has typed at least 2 characters
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

          <Autocomplete
            searchTerm={searchTerm}
            onSelectItem={handleSelectItem}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  autocompleteContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  autocompleteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  bottomSheetInput: {
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(151, 151, 151, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
  },
}));
