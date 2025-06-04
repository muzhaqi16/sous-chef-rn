import React from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import TextInput from '../atoms/TextInput';

type SearchBarProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onAddPress?: () => void; // For the plus button on the right
};

const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChangeText = () => {},
  placeholder = 'Search in shopping list...',
  onAddPress = undefined,
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    </View>
  );
};
const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.padding.sm,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: theme.font.size.md,
  },
}));
export default SearchBar;
