import React, { useState } from 'react';
import type {
  StyleProp,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { openWebUrl } from '#utils/externalUrl';
import { hitSlop } from '#/theme/foundations/sizes';
import { Text, type TextRole, type TextTone } from './Text';

/** `caption` is a small underlined credit, such as a data source's notice. */
type LinkVariant = 'primary' | 'subtle' | 'caption';

const LOOK: Record<LinkVariant, { role: TextRole; tone: TextTone }> = {
  primary: { role: 'bodyStrong', tone: 'accent' },
  subtle: { role: 'bodyStrong', tone: 'onSurfaceVariant' },
  caption: { role: 'caption', tone: 'secondary' },
};

interface LinkProps
  extends Omit<RNTextProps, 'style' | 'onPress' | 'disabled' | 'role'> {
  children: React.ReactNode;
  onPress?: () => void;
  /** Opened on press in place of `onPress`, only when it is a web address. */
  href?: string;
  disabled?: boolean;
  testID?: string;
  variant?: LinkVariant;
  style?: StyleProp<TextStyle>;
}

export const Link: React.FC<LinkProps> = ({
  children,
  onPress,
  href,
  disabled = false,
  testID,
  variant = 'primary',
  style,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);
  const handlePress =
    href === undefined
      ? onPress
      : () => {
          void openWebUrl(href);
        };
  const pressable = !disabled && !!handlePress;

  return (
    <Text
      role={LOOK[variant].role}
      {...rest}
      testID={testID}
      onPress={pressable ? handlePress : undefined}
      // Fade like a Pressable instead of iOS's grey box behind pressable text.
      suppressHighlighting
      onPressIn={pressable ? () => setPressed(true) : undefined}
      onPressOut={pressable ? () => setPressed(false) : undefined}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      tone={LOOK[variant].tone}
      style={[
        variant === 'caption' && styles.caption,
        disabled && styles.disabled,
        pressable && pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  // Text takes no `hitSlop`: the padding widens the touch area, and the
  // matching negative margin gives the layout back.
  caption: {
    textDecorationLine: 'underline',
    padding: hitSlop.sm,
    margin: -hitSlop.sm,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
