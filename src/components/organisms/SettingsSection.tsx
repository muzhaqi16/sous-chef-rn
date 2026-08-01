import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingRow, SettingRowProps } from '../molecules/SettingRow';
import { Text } from '#components/atoms/Text';

export interface SettingsSectionProps {
  title: string;
  items: SettingRowProps['item'][];
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  items,
}) => {
  return (
    <View style={[styles.section]}>
      <Text size="xs" weight="semibold" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.sectionBody}>
        {items.map((item, idx) => (
          <SettingRow
            key={item.key}
            item={item}
            isFirst={idx === 0}
            isLast={idx === items.length - 1}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
}));
