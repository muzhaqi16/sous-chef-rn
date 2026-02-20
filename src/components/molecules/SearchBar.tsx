import { type FC, type ReactNode } from 'react';
import { View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { ActionButton } from './ActionButton';
import { AnimatedActionButton } from '../atoms/AnimatedActionButton';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';

export interface SearchBarAction {
  icon: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  badge?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  library?: string;
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
  /** Show search icon inside the input field (left side) */
  showSearchIcon?: boolean;
  /** Custom icon/element to show inside the input field (right side, when not showing clear) */
  innerRightIcon?: ReactNode;
};

export const SearchBar: FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  containerStyle,
  inputStyle,
  leftActions = [],
  rightActions = [],
  showSearchIcon = false,
  innerRightIcon,
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
                accessibilityLabel={
                  action.accessibilityLabel || `${action.icon} button`
                }
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
                  backgroundColor:
                    action.backgroundColor || theme.colors.primary,
                  ...commonStyles.shadow,
                },
                action.style,
              ]}
              color={action.color || theme.colors.white}
              size={action.size}
              accessibilityLabel={
                action.accessibilityLabel || `${action.icon} button`
              }
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
        leftIcon={
          showSearchIcon ? (
            <Icon
              name="search"
              size={16}
              color={theme.colors.textTertiary}
            />
          ) : undefined
        }
        rightIcon={!value ? innerRightIcon : undefined}
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
