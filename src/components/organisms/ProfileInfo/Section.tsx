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
  section: {marginBottom: 24},
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionBody: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
}));
