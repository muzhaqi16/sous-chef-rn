import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const Chip: React.FC<ChipProps> = ({ label, selected, onPress, style }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      android_ripple={RIPPLE.SUBTLE}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        selected
          ? t('a11y.chipSelected', { label })
          : t('a11y.chipUnselected', { label })
      }
      accessibilityState={{ selected }}
    >
      <Text
        role="label"
        style={selected ? styles.selectedText : styles.unselectedText}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  chip: {
    paddingVertical: theme.spacing.xsPlus,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radii['2xl'],
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
  },
  selected: {
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  unselected: {
    backgroundColor: theme.colors.chipBackground,
  },
  selectedText: {
    color: theme.colors.chipSelectedText,
  },
  unselectedText: {
    color: theme.colors.chipText,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default Chip;
