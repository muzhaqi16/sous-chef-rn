import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { Row, RowProps } from './Row';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
      <Text
        size="xs"
        weight="semibold"
        tone="secondary"
        style={styles.sectionTitle}
      >
        {title}
      </Text>
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
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
}));
