import React, { useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text, type TextTone } from '#components/atoms/Text';
import {
  HeaderActionIcon,
  type ActionVariant,
  type HeaderAction,
} from '#components/molecules/HeaderActionIcon';
import { hitSlop, sizes } from '#/theme/foundations/sizes';

type MeasureHandler = NonNullable<HeaderAction['onMeasure']>;

/** A bar action named by its label — Save, Create, Clear. */
export interface HeaderTextAction {
  label: string;
  onPress: () => void;
  /** `primary` is the bar's confirm: bold, in the accent. */
  variant?: ActionVariant;
  disabled?: boolean;
  /** Only when the label alone under-describes the action. */
  accessibilityLabel?: string;
  testID?: string;
  onMeasure?: MeasureHandler;
}

/** What every bar's action slot takes; a bar never takes a bare node. */
export type BarAction = HeaderAction | HeaderTextAction;

const TEXT_TONE: Record<ActionVariant, TextTone> = {
  default: 'primary',
  primary: 'accent',
  secondary: 'secondary',
  success: 'success',
  error: 'danger',
  warning: 'warning',
};

type Placement = 'bar' | 'gutter';

interface BarActionsProps {
  actions?: readonly BarAction[];
  /** Status before the actions — the offline pill. */
  leading?: React.ReactNode;
  /**
   * `bar`: the bar pads by `commonStyles.barInset`, so each action is a whole
   * touch target. `gutter`: the bar sits on a content gutter, so the glyph
   * takes the edge and `hitSlop` supplies the target. Either way the outermost
   * glyph lands on the page gutter and glyphs sit the same distance apart.
   */
  placement?: Placement;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const MeasuredAction: React.FC<{
  onMeasure: MeasureHandler;
  children: React.ReactNode;
}> = ({ onMeasure, children }) => {
  const ref = useRef<View>(null);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => {
        requestAnimationFrame(() => {
          ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
            if (w > 0 && h > 0) {
              onMeasure({ x: pageX, y: pageY, width: w, height: h });
            }
          });
        });
      }}
    >
      {children}
    </View>
  );
};

const BarActionButton: React.FC<{
  action: BarAction;
  placement: Placement;
}> = ({ action, placement }) => {
  const isText = 'label' in action;

  const content = isText ? (
    <Text
      role={action.variant === 'primary' ? 'bodyStrong' : 'body'}
      tone={
        action.disabled ? 'tertiary' : TEXT_TONE[action.variant ?? 'default']
      }
      numberOfLines={1}
    >
      {action.label}
    </Text>
  ) : (
    <View>
      <HeaderActionIcon action={action} />
      {action.badge !== undefined && action.badge > 0 && (
        <View style={styles.badge}>
          <Text role="caption" tone="onPrimary" style={styles.badgeText}>
            {String(action.badge)}
          </Text>
        </View>
      )}
    </View>
  );

  const button = (
    <AppPressable
      style={styles.target(placement, isText)}
      onPress={action.onPress}
      disabled={!!action.disabled || (!isText && !!action.loading)}
      testID={action.testID}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      hitSlop={placement === 'bar' ? hitSlop.lg : GLYPH_SLACK}
    >
      {content}
    </AppPressable>
  );

  return action.onMeasure ? (
    <MeasuredAction onMeasure={action.onMeasure}>{button}</MeasuredAction>
  ) : (
    button
  );
};

export const BarActions: React.FC<BarActionsProps> = ({
  actions = [],
  leading,
  placement = 'bar',
  onLayout,
}) => {
  return (
    <View style={styles.group(placement)} onLayout={onLayout}>
      {leading}
      {actions.map((action, index) => (
        <BarActionButton key={index} action={action} placement={placement} />
      ))}
    </View>
  );
};

// What a 24pt glyph centred in its 44pt target leaves on each side. Sizes do
// not scale with density, so the foundation value is the theme's.
const GLYPH_SLACK = (sizes.touchTarget.md - sizes.icon.md) / 2;

const styles = StyleSheet.create(theme => {
  const slack = GLYPH_SLACK;
  return {
    group: (placement: Placement) => ({
      flexDirection: 'row',
      alignItems: 'center',
      // A gutter target has no slack of its own, so the gap carries it.
      gap: theme.spacing.sm + (placement === 'gutter' ? slack * 2 : 0),
    }),
    target: (placement: Placement, isText: boolean) =>
      placement === 'bar'
        ? {
            minWidth: theme.sizes.touchTarget.md,
            minHeight: theme.sizes.touchTarget.md,
            ...(isText && { paddingHorizontal: slack }),
            justifyContent: 'center',
            alignItems: 'center',
          }
        : { justifyContent: 'center', alignItems: 'center' },
    badge: {
      position: 'absolute',
      top: -theme.spacing.xs,
      right: -theme.spacing.xsPlus,
      minWidth: theme.spacing.md,
      height: theme.spacing.md,
      paddingHorizontal: theme.spacing['2xsPlus'],
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: theme.fonts.size['3xs'],
      fontWeight: theme.fonts.weight.bold,
    },
  };
});
