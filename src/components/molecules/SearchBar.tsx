import { type FC } from 'react';
import { View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BaseInput, ActionButton, AnimatedActionButton } from '#components';
import { commonStyles } from '#/styles';

export interface SearchBarAction {
  icon: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  badge?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  library?: 'MaterialDesignIcons' | 'Ionicons' | 'FontAwesome' | string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  animated?: boolean;
  isHighlighted?: boolean;
  testID?: string; // Optional testID for E2E testing
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
};

export const SearchBar: FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  containerStyle,
  inputStyle,
  leftActions = [],
  rightActions = [],
  ...textInputProps
}) => {
  const { theme } = useUnistyles();
  // Handle legacy props by converting them to action arrays

  const renderActionButtons = (
    actions: SearchBarAction[],
    side: 'left' | 'right',
  ) => {
    if (actions.length === 0) return null;

    return (
      <View style={[styles.actionsContainer]}>
        {actions.map((action, index) => {
          if (action.animated) {
            return (
              <AnimatedActionButton
                key={`${side}-${index}-${action.icon}`}
                name={action.icon}
                onPress={action.onPress}
                style={[
                  {
                    ...commonStyles.shadow,
                  },
                  action.style,
                ]}
                color={action.color || theme.colors.white}
                backgroundColor={action.backgroundColor || theme.colors.primary}
                size={action.size}
                accessibilityLabel={action.accessibilityLabel || `${action.icon} button`}
                isHighlighted={action.isHighlighted}
                testID={action.testID}
              />
            );
          }

          return (
            <ActionButton
              key={`${side}-${index}-${action.icon}`}
              name={action.icon}
              onPress={action.onPress}
              style={[
                {
                  backgroundColor: action.backgroundColor || theme.colors.primary,
                  ...commonStyles.shadow,
                },
                action.style,
              ]}
              color={action.color || '#fff'}
              size={action.size}
              accessibilityLabel={action.accessibilityLabel || `${action.icon} button`}
              testID={action.testID}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {renderActionButtons(leftActions, 'left')}

      <BaseInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={inputStyle}
        containerStyle={styles.inputContainer}
        showClearIcon={true}
        onClear={() => onChangeText('')}
        {...textInputProps}
      />

      {renderActionButtons(rightActions, 'right')}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  inputContainer: {
    flex: 1,
    borderRadius: theme.radii.md,
    ...commonStyles.shadow,
  },
  actionsContainer: {
    flexDirection: 'row',
  },
}));
