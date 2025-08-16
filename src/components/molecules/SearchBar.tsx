import React from 'react';
import {View, StyleProp, ViewStyle, TextInputProps} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {BaseInput, ActionButton} from '#components';

export interface SearchBarAction {
  icon: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  badge?: number;
  size?: number;
  library?: 'MaterialDesignIcons' | 'Ionicons' | 'FontAwesome' | string;
  style?: StyleProp<ViewStyle>;
}

type SearchBarProps = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  listName?: string;
  itemCount?: number;
  completedCount?: number;
  leftActions?: SearchBarAction[];
  rightActions?: SearchBarAction[];
  // Keep legacy props for backward compatibility
  onPressList?: () => void;
  onPressAdd?: () => void;
};

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  containerStyle,
  inputStyle,
  leftActions = [],
  rightActions = [],
  listName = 'List',
  // Legacy props for backward compatibility
  onPressList,
  onPressAdd,
  ...textInputProps
}) => {
  const {styles, theme} = useStyles(stylesheet);

  // Handle legacy props by converting them to action arrays
  const finalLeftActions = React.useMemo(() => {
    const actions = [...leftActions];
    if (onPressList && !leftActions.some(action => action.icon === 'list')) {
      actions.push({
        icon: 'list',
        onPress: onPressList,
        backgroundColor: theme.colors.primary,
        color: '#fff',
      });
    }
    return actions;
  }, [leftActions, onPressList, theme.colors.primary]);

  const finalRightActions = React.useMemo(() => {
    const actions = [...rightActions];
    if (onPressAdd && !rightActions.some(action => action.icon === 'add')) {
      actions.push({
        icon: 'add',
        onPress: onPressAdd,
        backgroundColor: theme.colors.white,
        color: theme.colors.primary,
      });
    }
    return actions;
  }, [rightActions, onPressAdd, theme.colors.primary, theme.colors.white]);

  const renderActionButtons = (
    actions: SearchBarAction[],
    side: 'left' | 'right',
  ) => {
    if (actions.length === 0) return null;

    return (
      <View
        style={[
          styles.actionsContainer,
          side === 'left' ? styles.leftActions : styles.rightActions,
        ]}>
        {actions.map((action, index) => (
          <ActionButton
            key={`${side}-${index}-${action.icon}`}
            name={action.icon}
            onPress={action.onPress}
            style={[
              styles.actionButton,
              {
                backgroundColor: action.backgroundColor || theme.colors.primary,
              },
              action.style,
            ]}
            color={action.color || '#fff'}
            size={action.size}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {renderActionButtons(finalLeftActions, 'left')}

      <BaseInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.input, inputStyle]}
        containerStyle={styles.inputContainer}
        {...textInputProps}
      />

      {renderActionButtons(finalRightActions, 'right')}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    gap: theme.spacing.xs,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    // any default text-input styling you want
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  leftActions: {
    // Any specific styling for left actions
  },
  rightActions: {
    // Any specific styling for right actions
  },
  actionButton: {
    // Default action button styling
  },
}));
