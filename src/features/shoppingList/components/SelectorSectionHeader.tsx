import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, type IconName } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';

interface SelectorSectionHeaderProps {
  icon: IconName;
  title: string;
}

/** A group's heading in the list selector. */
export const SelectorSectionHeader: React.FC<SelectorSectionHeaderProps> = ({
  icon,
  title,
}) => (
  <View style={styles.sectionHeader}>
    <Icon name={icon} size={14} tone="textTertiary" />
    <Text role="label" tone="tertiary" style={styles.sectionHeaderText}>
      {title}
    </Text>
  </View>
);

const styles = StyleSheet.create(theme => ({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  sectionHeaderText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}));
