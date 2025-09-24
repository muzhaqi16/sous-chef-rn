import React, {ReactNode} from 'react';
import {View, Text} from 'react-native';
import {Row, RowProps} from './Row';
import {StyleSheet} from 'react-native-unistyles';

export interface SectionProps {
  title: string;
  rows?: RowProps[];
  children?: ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  rows = [],
  children,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>
        {children
          ? children
          : rows.map((row, index) => {
              const key = `${title}-${row.label}-${index}`;
              const isFirst = index === 0;
              const isLast = index === rows.length - 1;
              return (
                <Row key={key} {...row} isFirst={isFirst} isLast={isLast} />
              );
            })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {marginBottom: theme.spacing.lg},
  sectionTitle: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
}));
