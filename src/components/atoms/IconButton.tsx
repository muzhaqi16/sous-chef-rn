import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import type { IconLibrary, IconSizeName } from '#components/atoms/Icon';
import { Icon, type IconTone } from '#components/atoms/Icon';
import { HapticService } from '#services/haptic/HapticService';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import {
  OnPrimaryActivityIndicator,
  Pressable,
  ThemedActivityIndicator,
} from '#components/atoms/themedComponents';
import { borderlessRipple } from '#constants/ripple';
import { useInGestureRow } from '#context/GestureRowContext';

const UniIcon = withUnistyles(Icon);

const BORDERLESS_RIPPLE = borderlessRipple(22);

export interface IconButtonProps {
  /** glyph name to render */
  name: string;
  /** tap handler */
  onPress: () => void;
  /** Accessibility label (required for screen readers) */
  accessibilityLabel: string;
  /** Additional context for screen readers */
  accessibilityHint?: string;
  /** Accessibility role (defaults to 'button') */
  accessibilityRole?: 'button' | 'imagebutton';
  /** A step of the icon ramp (default 'md'); the target stays 44pt. */
  size?: IconSizeName;
  /**
   * Named colour role. `tone` is how a caller asks for a theme colour, so a
   * themed icon button needs no `withUnistyles` wrapper of its own.
   */
  tone?: IconTone;
  /** A colour the theme does not name — a brand tint, a photo overlay. */
  color?: string;
  /** extra styling on the Pressable */
  style?: StyleProp<ViewStyle>;
  library?: IconLibrary;
  /** whether button is disabled */
  disabled?: boolean;
  /** A toggle's state, such as a pinned store; left out, the button is no toggle. */
  selected?: boolean;
  /**
   * A fill drawn at its own size, centred in the target, which stays the
   * platform floor (44 pt iOS, 48 dp Android) whatever the fill.
   */
  filled?: IconFill;
  /** A spinner in place of the glyph while the action runs; the button waits. */
  loading?: boolean;
  /** test ID for testing */
  testID?: string;
}

/** A shape an `IconButton` draws its glyph on. */
export interface IconFill {
  /** A step of `theme.sizes.iconFill`. */
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tone: 'primary' | 'primaryLight' | 'background' | 'error' | 'scrim';
  /** Default `circle`. */
  shape?: 'circle' | 'rounded';
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  size = 'md',
  tone,
  color,
  style,
  library,
  disabled = false,
  selected,
  filled,
  loading = false,
  testID,
}) => {
  const inGestureRow = useInGestureRow();
  const variantStyles = styles.useVariants({
    fillTone: filled?.tone,
    fillShape: filled ? filled.shape ?? 'circle' : undefined,
  });
  const handlePress = () => {
    HapticService.selection();
    onPress();
  };

  const pressProps = {
    style: ({ pressed }: { pressed: boolean }) => [
      variantStyles.button,
      pressed && !disabled && variantStyles.pressed,
      style,
    ],
    onPress: handlePress,
    disabled: disabled || loading,
    android_ripple: BORDERLESS_RIPPLE,
    accessibilityRole,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState: {
      disabled: disabled || loading,
      ...(loading ? { busy: true } : {}),
      ...(selected === undefined ? {} : { selected }),
    },
    testID,
  };
  const spinner =
    filled?.tone === 'primary' ? (
      <OnPrimaryActivityIndicator size="small" />
    ) : (
      <ThemedActivityIndicator size="small" />
    );
  const glyph = loading ? (
    spinner
  ) : (
    <UniIcon
      library={library}
      name={name}
      size={size}
      tone={disabled ? 'iconDisabled' : tone ?? 'iconPrimary'}
      uniProps={() => (color && !disabled ? { color } : {})}
    />
  );
  const icon = filled ? (
    <View style={[variantStyles.fill, variantStyles.fillBox(filled.size)]}>
      {glyph}
    </View>
  ) : (
    glyph
  );

  // Inside a swipe row, RNGH's: an RN Pressable there takes the touch, and a
  // swipe that starts on the button never moves the row.
  return inGestureRow ? (
    <GesturePressable {...pressProps}>{icon}</GesturePressable>
  ) : (
    <Pressable {...pressProps}>{icon}</Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    minWidth: theme.sizes.touchTarget.min,
    minHeight: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  fillBox: (size: IconFill['size']) => ({
    width: theme.sizes.iconFill[size],
    height: theme.sizes.iconFill[size],
  }),
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      fillTone: {
        primary: { backgroundColor: theme.colors.primary },
        primaryLight: { backgroundColor: theme.colors.primaryLight },
        background: { backgroundColor: theme.colors.background },
        error: { backgroundColor: theme.colors.validation.errorBg },
        scrim: { backgroundColor: theme.colors.overlays.dark },
      },
      fillShape: {
        circle: { borderRadius: theme.radii.full },
        rounded: { borderRadius: theme.radii.md, borderCurve: 'continuous' },
      },
    },
  },
}));
