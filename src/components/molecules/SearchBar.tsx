import React from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import TextInput from '../atoms/TextInput';
import IconButton from '../atoms/IconButton';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onAddPress?: () => void; // For the plus button on the right
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
}));

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search in shopping list...',
  onAddPress,
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
      {onAddPress && (
        <IconButton
          iconName="add-circle-outline"
          onPress={onAddPress}
          size={28}
        />
      )}
    </View>
  );
};

export default SearchBar;
