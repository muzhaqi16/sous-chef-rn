import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import type { ReligiousDiet } from '#/graphql/generated/schemaTypes';
import { RELIGIOUS_DIET_OPTIONS } from '#domain/dietary';

interface ReligiousDietPickerProps {
  value: ReligiousDiet | null;
  onChange: (next: ReligiousDiet | null) => void;
}

/**
 * Halal or Kosher, at most one, a tap on the chosen one clearing it. Private:
 * it screens the user's own suggestions and is never shown to their homes.
 */
export const ReligiousDietPicker = ({
  value,
  onChange,
}: ReligiousDietPickerProps) => {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text role="bodyStrong">{t('dietaryProfile.religiousDietTitle')}</Text>
      <View style={styles.chips}>
        {RELIGIOUS_DIET_OPTIONS.map(option => (
          <AnimatedChip
            key={option.value}
            label={t(option.labelKey)}
            selected={value === option.value}
            onPress={() =>
              onChange(value === option.value ? null : option.value)
            }
          />
        ))}
      </View>
      <Text role="caption" tone="secondary">
        {t('dietaryProfile.religiousDietPrivate')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    gap: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
}));
