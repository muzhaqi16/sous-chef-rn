import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import {
  Pressable,
  ThemedTextInput,
  type ThemedTextInputRef,
} from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

const CODE_LENGTH = 6;

export const CodeInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  /** Fires once when the final digit lands (typed or pasted). */
  onComplete?: (code: string) => void;
  onBlur?: () => void;
  error?: string;
}> = ({ value, onChange, onComplete, onBlur }) => {
  const { t } = useTranslation();
  const inputRef = useRef<ThemedTextInputRef>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (raw: string) => {
    // Strip non-digits so codes pasted with separators ("123-456", "123 456")
    // survive intact. The cap lives here rather than in maxLength — maxLength
    // truncates the raw paste before this handler runs, which would drop the
    // last digit of a separator-formatted code.
    const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(next);
    if (next.length === CODE_LENGTH && next !== value) {
      onComplete?.(next);
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.formInput}>
        <ThemedTextInput
          ref={inputRef}
          style={styles.formInputControl}
          keyboardType="number-pad"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          accessibilityLabel={t('auth.verificationCodeInputLabel')}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="done"
        />
        {/* Decorative mirror of the hidden input — hide it from screen
            readers so the code isn't announced twice. */}
        <View
          style={styles.formInputOverflow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Single Text per cell — a nested Text span would carry the atom's
              default body lineHeight, shrinking the line box and pinning the
              placeholder to the top of the cell instead of centering it. */}
          {Array.from({ length: CODE_LENGTH }).map((_, idx) => {
            const char = value[idx];
            const isActive = isFocused && idx === activeIndex;
            return (
              <View key={idx} style={styles.formInputCell}>
                <Text
                  align="center"
                  weight={char ? 'semibold' : 'regular'}
                  tone={char ? 'primary' : 'tertiary'}
                  style={[
                    styles.formInputChar,
                    !char && styles.formInputPlaceholderChar,
                  ]}
                >
                  {char ?? '-'}
                </Text>
                {isActive ? (
                  <View style={styles.formInputCellIndicator} />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  formInput: {
    position: 'relative',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
  },
  formInputControl: {
    height: theme.sizes.input.lg + theme.spacing.sm,
    color: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.md,
    zIndex: 2,
    opacity: 0,
  },
  formInputOverflow: {
    zIndex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.md,
  },
  formInputCell: {
    flex: 1,
  },
  formInputChar: {
    lineHeight: theme.sizes.input.lg + theme.spacing.sm,
    fontSize: theme.typography.fontSize['4xl'] - 2,
  },
  // Placeholder dash keeps the cell's centering lineHeight but renders at
  // body size, matching the look of the old nested-Text placeholder.
  formInputPlaceholderChar: {
    fontSize: theme.fonts.size.md,
  },
  formInputCellIndicator: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: '25%',
    right: '25%',
    height: 2,
    borderRadius: 1,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
