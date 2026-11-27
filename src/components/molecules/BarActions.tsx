import React from 'react';
import { CountBadge } from '#components/atoms/CountBadge';
import { StatusMark } from '#components/atoms/StatusMark';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text, type TextTone } from '#components/atoms/Text';
import {
  HeaderActionIcon,
  type ActionVariant,
  type HeaderAction,
} from '#components/molecules/HeaderActionIcon';
import { hitSlop, sizes } from '#theme/foundations/sizes';
import type { Theme } from '#theme/themes';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';

type MeasureHandler = NonNullable<HeaderAction['onMeasure']>;

/** A bar action named by its label — Save, Create, Clear. */
export interface HeaderTextAction {
  label: string;
  onPress: () => void;
  /** `primary` is the bar's confirm: bold, in the accent. */
  variant?: ActionVariant;
  /**
   * False: nothing new to confirm, so it reads in plain text and keeps its tap;
   * the accent then says there is something to save. Unset keeps the variant's.
   */
  hasChanges?: boolean;
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
   * touch target. `gutter`: the bar sits on a content gutter, so its whole
   * targets are pulled out by their slack (see `gutterTargetGeometry`). Either
   * way the outermost glyph lands on the page gutter.
   */
  placement?: Placement;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const MeasuredAction: React.FC<{
  onMeasure: MeasureHandler;
  children: React.ReactNode;
}> = ({ onMeasure, children }) => {
  const { ref, measure } = useMeasuredRect(onMeasure);
  return (
    <View ref={ref} collapsable={false} onLayout={measure}>
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
        action.disabled
          ? 'tertiary'
          : action.hasChanges === false
          ? 'primary'
          : TEXT_TONE[action.variant ?? 'default']
      }
      numberOfLines={1}
    >
      {action.label}
    </Text>
  ) : (
    <View>
      <HeaderActionIcon action={action} />
      <CountBadge count={action.badge} />
      <StatusMark icon={action.mark} />
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
      hitSlop={placement === 'bar' ? hitSlop.lg : undefined}
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
  // An empty group pulled out would hand its pull to the title beside it.
  const pulled = placement === 'gutter' && (actions.length > 0 || !!leading);
  return (
    <View style={styles.group(pulled)} onLayout={onLayout}>
      {leading}
      {actions.map((action, index) => (
        <BarActionButton key={index} action={action} placement={placement} />
      ))}
    </View>
  );
};

// What a 24pt glyph centred in its 44pt target leaves on each side, for a
// bar that reserves it in its own inset.
const GLYPH_SLACK = (sizes.touchTarget.md - sizes.icon.md) / 2;

/**
 * A gutter bar's target is a whole box at the platform floor, and the group is
 * pulled out by the glyph's slack in it, so the outermost glyph lands on the
 * gutter. Read from the theme: the glyph grows with density, the floor does not.
 */
export const gutterTargetGeometry = (theme: Theme) => {
  const box = theme.sizes.touchTarget.min;
  return { box, pull: (box - theme.sizes.icon.md) / 2 };
};

const styles = StyleSheet.create(theme => {
  const { box, pull } = gutterTargetGeometry(theme);
  return {
    group: (pulled: boolean) => ({
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      ...(pulled && {
        marginHorizontal: -pull,
        marginVertical: -pull,
      }),
    }),
    target: (placement: Placement, isText: boolean) =>
      placement === 'bar'
        ? {
            minWidth: theme.sizes.touchTarget.md,
            minHeight: theme.sizes.touchTarget.md,
            ...(isText && { paddingHorizontal: GLYPH_SLACK }),
            justifyContent: 'center',
            alignItems: 'center',
          }
        : {
            minWidth: box,
            minHeight: box,
            ...(isText && { paddingHorizontal: pull }),
            justifyContent: 'center',
            alignItems: 'center',
          },
  };
});
