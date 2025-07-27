import React from 'react';
import {View, StyleProp, ViewStyle, TextInputProps} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {BaseInput} from '../atoms/BaseInput';

type SearchBarProps = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
};

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  containerStyle,
  inputStyle,
  leftComponent,
  rightComponent,
  ...textInputProps
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={[styles.container, containerStyle]}>
      <BaseInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.input, inputStyle]}
        containerStyle={styles.inputContainer}
        {...textInputProps}
      />
      {!!leftComponent && <View style={styles.side}>{leftComponent}</View>}
      {!!rightComponent && <View style={styles.side}>{rightComponent}</View>}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  side: {},
  inputContainer: {
    // allow input to take full width
    flex: 1,
  },
  input: {
    // any default text-input styling you want
  },
}));

export default SearchBar;
