import React from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {BaseInput} from '../atoms/BaseInput';

type SearchBarProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onAddPress?: () => void; // For the plus button on the right
  style?: StyleProp<ViewStyle>; // <---- ADD THIS
};

const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChangeText = () => {},
  placeholder = 'Search in shopping list...',
  onAddPress = undefined,
  style = {},
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <BaseInput
      style={style} // <--- add style here
      value={value}
      containerStyle={styles.inputContainer}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
};
const stylesheet = createStyleSheet(theme => ({
  inputContainer: {
    flex: 1, // Allows the input to expand if needed
  },
}));

export default SearchBar;
