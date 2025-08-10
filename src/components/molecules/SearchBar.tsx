import React from 'react';
import {View, StyleProp, ViewStyle, TextInputProps} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {BaseInput, ActionButton} from '#components';

type SearchBarProps = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  listName?: string;
  itemCount?: number;
  completedCount?: number;
  onPressList?: () => void;
  onPressAdd?: () => void;
};

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  containerStyle,
  inputStyle,
  onPressList = () => {},
  onPressAdd = () => {},
  listName = 'List',
  ...textInputProps
}) => {
  const {styles, theme} = useStyles(stylesheet);

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
      <ActionButton
        name="list"
        onPress={onPressList}
        style={styles.listButton}
        color="#fff"
      />
      <ActionButton
        name="add"
        onPress={onPressAdd}
        style={styles.addButton}
        color={theme.colors.primary}
      />
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
  listButton: {
    backgroundColor: theme.colors.primary,
  },
  addButton: {
    backgroundColor: theme.colors.white,
  },
}));
