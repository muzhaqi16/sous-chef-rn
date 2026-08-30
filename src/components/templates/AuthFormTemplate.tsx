import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import type { FieldValues, Control, FieldErrors } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../molecules/DynamicFormFields';
import { Button } from '#components/atoms/Button';
import { BackButton } from '../atoms/BackButton';
import { Link } from '../atoms/Link';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.textOnSurfaceVariant,
}));

interface Props<T extends FieldValues> {
  title: string;
  subtitle?: string | React.ReactNode;
  onBackPress?: () => void;
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
  submitText: string;
  submitButtonTestID?: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  /** Seconds left on a cooldown, appended to the button label while > 0. */
  submitCountdown?: number;
  footerText?: string;
  footerLinkText?: string;
  footerLinkTestID?: string;
  onFooterLinkPress?: () => void;
  footerLinkDisabled?: boolean;
  footerLinkCountdown?: number; // seconds remaining for countdown display
  onLinkPress?: () => void;
  linkText?: string;
  linkTestID?: string;
  linkDisabled?: boolean;
  /** Seconds left on a cooldown, appended to the link label while > 0. */
  linkCountdown?: number;
  isLoading?: boolean;
  /** Return key moves down the fields instead of just closing the keyboard. */
  focusChaining?: boolean;
  /**
   * Where the fields sit in the leftover height: `center` splits it with the
   * button block, `top` parks them below the header. Required, because a default
   * silently re-lays out every screen that predates it.
   */
  contentPlacement: 'center' | 'top';
}
export function AuthFormTemplate<T extends FieldValues>({
  title,
  subtitle,
  onBackPress = undefined,
  fields,
  control,
  errors,
  submitText,
  submitButtonTestID,
  onSubmit,
  submitDisabled,
  submitCountdown,
  footerText,
  footerLinkText,
  footerLinkTestID,
  onFooterLinkPress,
  footerLinkDisabled,
  footerLinkCountdown,
  linkText,
  linkTestID,
  onLinkPress,
  linkDisabled,
  linkCountdown,
  isLoading = false,
  focusChaining = false,
  contentPlacement,
}: Props<T>) {
  // With the keyboard up the scroll view keeps its full height, so the flexible
  // slack survives and pushes the fields under it. Collapsing the slack keeps the
  // whole form, header included, above the keyboard.
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [transitionMs, setTransitionMs] = useState(TIMING.MODERATE);

  // `onStart` carries the DESTINATION of a movement about to begin, so the layout
  // transition runs alongside the keyboard in both directions — `useKeyboardState`
  // only reports a dismissal once hiding has FINISHED. `onEnd` settles movements
  // that raise no start, like an interactive drag-to-dismiss.
  // `useGenericKeyboardHandler` is the variant that does not set the Android
  // soft-input mode, which the manifest and the scroll view already declare.
  useGenericKeyboardHandler(
    {
      onStart: e => {
        'worklet';

        scheduleOnRN(setIsKeyboardVisible, e.progress === 1);
        // Below Android 11 the reported duration can be 0; 250ms is what the
        // library itself substitutes there.
        scheduleOnRN(
          setTransitionMs,
          e.duration > 0 ? e.duration : TIMING.MODERATE,
        );
      },
      onEnd: e => {
        'worklet';

        scheduleOnRN(setIsKeyboardVisible, e.progress === 1);
      },
    },
    [],
  );

  const layoutTransition = LinearTransition.duration(transitionMs);

  // The keyboard overrides the caller's placement: no leftover height to split.
  styles.useVariants({
    compact: isKeyboardVisible,
    fieldsPlacement: isKeyboardVisible ? 'compact' : contentPlacement,
  });

  return (
    <View style={styles.formContainer}>
      <View>
        <View style={styles.titleRow} testID="auth-title-row">
          {!!onBackPress && (
            <ThemedBackButton
              onPress={onBackPress}
              style={styles.headerAction}
            />
          )}

          <Text size="2xl" weight="bold" tone="primary" align="center">
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text
            size="md"
            tone="secondary"
            align="center"
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Animated.View style={styles.fieldsGroup} layout={layoutTransition}>
        <DynamicFormFields<T>
          fields={fields}
          control={control}
          errors={errors}
          focusChaining={focusChaining}
        />

        {!!linkText && !!onLinkPress && (
          <View style={styles.linkRow}>
            <Link
              onPress={onLinkPress}
              testID={linkTestID}
              disabled={linkDisabled}
            >
              {linkCountdown && linkCountdown > 0
                ? `${linkText} (${linkCountdown}s)`
                : linkText}
            </Link>
          </View>
        )}
      </Animated.View>

      <Animated.View style={styles.action} layout={layoutTransition}>
        <Button
          title={
            submitCountdown && submitCountdown > 0
              ? `${submitText} (${submitCountdown}s)`
              : submitText
          }
          onPress={onSubmit}
          disabled={isLoading || submitDisabled}
          loading={isLoading}
          testID={submitButtonTestID}
        />
      </Animated.View>

      {!!footerText && !!footerLinkText && !!onFooterLinkPress && (
        <Animated.View layout={layoutTransition}>
          <Pressable
            onPress={onFooterLinkPress}
            disabled={footerLinkDisabled}
            testID={footerLinkTestID}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text
              tone="secondary"
              align="center"
              style={[
                styles.footer,
                footerLinkDisabled && styles.footerDisabled,
              ]}
            >
              {footerText}{' '}
              <Link disabled={footerLinkDisabled}>
                {footerLinkCountdown && footerLinkCountdown > 0
                  ? `${footerLinkText} (${footerLinkCountdown}s)`
                  : footerLinkText}
              </Link>
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  formContainer: {
    flex: 1,
  },
  fieldsGroup: {
    variants: {
      fieldsPlacement: {
        center: { marginTop: 'auto' },
        // A fixed gap instead, so the rest of the height falls below the fields.
        top: { marginTop: theme.spacing['3xl'] },
        // Keyboard up: straight under the header, nothing to distribute.
        compact: { marginTop: 0 },
      },
    },
  },
  headerAction: {
    // Absolute so a screen with a back button starts its title at the same height
    // as one without. `start`, not `left`, so it flips under RTL.
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    zIndex: 1,
    width: theme.sizes.button.md,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.transparent,
  },
  titleRow: {
    minHeight: theme.sizes.button.md,
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    // Clears the absolute back button on both sides, so a long localized title
    // cannot render underneath it and lose taps to it.
    paddingHorizontal: theme.sizes.button.md,
  },
  subtitle: {
    variants: {
      compact: {
        true: { marginBottom: theme.spacing.md },
        false: { marginBottom: theme.spacing.xl },
      },
    },
  },
  linkRow: {
    alignItems: 'flex-end',
  },
  action: {
    // Paired with the same auto margin on `fieldsGroup`, splitting the leftover
    // height so the fields sit mid-screen. Both resolve to 0 on a screen with no
    // leftover; the padding is what keeps a gap above the button there.
    variants: {
      compact: {
        true: {
          marginTop: 0,
          paddingTop: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        false: {
          marginTop: 'auto',
          paddingTop: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        },
      },
    },
  },
  footer: {
    variants: {
      compact: {
        true: { paddingVertical: theme.spacing.sm },
        false: { paddingVertical: theme.spacing.lg },
      },
    },
  },
  footerDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
