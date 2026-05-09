import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { View, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import {
  StyleSheet,
  useUnistyles,
  withUnistyles,
} from 'react-native-unistyles';
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
  /** Callback with screen-coordinate rect when the button lays out (for spotlight tutorials) */
  onButtonLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
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

const ThemedActionButton = withUnistyles(ActionButton);
const ThemedAnimatedActionButton = withUnistyles(AnimatedActionButton);

/**
 * Wrapper that measures an action button's screen position for spotlight tutorials.
 * ActionButton has marginLeft which shifts the visual button right of the layout
 * origin. We measure the wrapper then trim the margin so the reported rect
 * matches only the visible button area.
 */
const MeasuredAction: FC<{
  onButtonLayout: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  children: ReactNode;
}> = ({ onButtonLayout, children }) => {
  const ref = useRef<View>(null);
  // Subscribe to theme changes so the reported rect stays in sync with the
  // density/spacing override applied by `useAppearance`. Reading
  // `theme.spacing.sm` here (a) makes the dependency explicit to the React
  // Compiler / Unistyles tracker and (b) gives us a stable closure value
  // for the effect that triggers a fresh measure when spacing shifts.
  const { theme } = useUnistyles();
  const margin = theme.spacing.sm;

  const handleLayout = () => {
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onButtonLayout({
            x: pageX + margin,
            y: pageY,
            width: w - margin,
            height: h,
          });
        }
      });
    });
  };

  // Force a re-measure whenever spacing changes — the inner button's
  // dimensions usually shift along with theme spacing and re-fire onLayout
  // naturally, but this guarantees the rect stays correct even when they
  // don't (e.g. high-contrast toggle that only changes colors).
  useEffect(() => {
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onButtonLayout({
            x: pageX + margin,
            y: pageY,
            width: w - margin,
            height: h,
          });
        }
      });
    });
  }, [margin, onButtonLayout]);

  return (
    <View ref={ref} collapsable={false} onLayout={handleLayout}>
      {children}
    </View>
  );
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
  // Handle legacy props by converting them to action arrays

  const renderActionButtons = (
    actions: SearchBarAction[],
    side: 'left' | 'right',
  ) => {
    if (actions.length === 0) return null;

    return (
      <View style={styles.actionsContainer}>
        {actions.map((action, index) => {
          const key = `${side}-${index}-${action.icon}`;
          const button = action.animated ? (
            <ThemedAnimatedActionButton
              key={key}
              name={action.icon}
              onPress={action.onPress}
              style={[{ ...commonStyles.shadow }, action.style]}
              uniProps={t => ({
                color: action.color ?? t.colors.white,
                backgroundColor: action.backgroundColor ?? t.colors.primary,
              })}
              size={action.size}
              accessibilityLabel={
                action.accessibilityLabel || `${action.icon} button`
              }
              isHighlighted={action.isHighlighted}
              testID={action.testID}
            />
          ) : (
            <ThemedActionButton
              key={key}
              name={action.icon}
              onPress={action.onPress}
              uniProps={t => ({
                style: [
                  {
                    backgroundColor: action.backgroundColor ?? t.colors.primary,
                    ...commonStyles.shadow,
                  },
                  action.style,
                ],
                color: action.color ?? t.colors.white,
              })}
              size={action.size}
              accessibilityLabel={
                action.accessibilityLabel || `${action.icon} button`
              }
              testID={action.testID}
            />
          );

          if (action.onButtonLayout) {
            return (
              <MeasuredAction key={key} onButtonLayout={action.onButtonLayout}>
                {button}
              </MeasuredAction>
            );
          }

          return button;
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
            <Icon name="search" size={16} tone="textTertiary" />
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
