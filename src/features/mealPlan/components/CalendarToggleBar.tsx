import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { hitSlop } from '#/theme/foundations/sizes';

interface CalendarToggleBarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export const CalendarToggleBar: React.FC<CalendarToggleBarProps> = ({
  isExpanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: hitSlop.md, bottom: hitSlop.md }}
      style={styles.container}
      accessibilityLabel={
        isExpanded
          ? t('calendarToggle.collapseToWeek')
          : t('calendarToggle.expandToMonth')
      }
      accessibilityRole="button"
    >
      <View style={styles.line} />
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        tone="textTertiary"
      />
      <View style={styles.line} />
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    maxWidth: 80,
  },
}));
