import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {SettingRow, SettingRowProps} from '../molecules/SettingRow';

export interface SettingsSectionProps {
  title: string;
  items: SettingRowProps['item'][];
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  items,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  section: {marginBottom: 32},
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionBody: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
}));
