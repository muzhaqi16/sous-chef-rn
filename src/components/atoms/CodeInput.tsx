import React, { useRef } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

export const CodeInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  error?: string;
}> = ({ value, onChange }) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.formInput}>
        <TextInput
          ref={inputRef}
          style={styles.formInputControl}
          keyboardType="number-pad"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          caretHidden
          value={value}
          onChangeText={v => onChange(v.slice(0, 6))}
          returnKeyType="done"
        />
        <View style={styles.formInputOverflow}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Text
              key={idx}
              align="center"
              weight="semibold"
              style={styles.formInputChar}
            >
              {value[idx] ?? (
                <Text tone="tertiary" weight="regular">
                  -
                </Text>
              )}
            </Text>
          ))}
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
  formInputChar: {
    flex: 1,
    lineHeight: theme.sizes.input.lg + theme.spacing.sm,
    fontSize: theme.typography.fontSize['4xl'] - 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
