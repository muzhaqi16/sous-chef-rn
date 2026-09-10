import React from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { styles } from './dashboardStyles';

/** Column widths the dashboard tables share, keyed by role. */
const HEADER_STYLE = {
  name: styles.tableHeaderName,
  avg: styles.tableHeaderAvg,
  max: styles.tableHeaderMax,
  total: styles.tableHeaderTotal,
  count: styles.tableHeaderCount,
};

const CELL_STYLE = {
  name: styles.tableCellName,
  avg: styles.tableCellAvg,
  max: styles.tableCellMax,
  total: styles.tableCellTotal,
  count: styles.tableCellCount,
};

export type MetricColumnRole = keyof typeof HEADER_STYLE;

export interface MetricColumn<T> {
  role: MetricColumnRole;
  label: string;
  value: (row: T) => string | number;
}

/**
 * Alternating-row container. Variants keep the alt-row background in the
 * stylesheet, so the parent needs no `useUnistyles`.
 */
const ZebraTableRow: React.FC<{
  alt: boolean;
  children: React.ReactNode;
}> = ({ alt, children }) => {
  styles.useVariants({ alt });
  return <View style={styles.tableRow}>{children}</View>;
};

interface MetricTableProps<T> {
  columns: MetricColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
}

/**
 * The dashboard's table shape: a `name` column that truncates and right-aligned
 * numeric columns. The first column is the name; the rest are right-aligned.
 */
export function MetricTable<T>({ columns, rows, rowKey }: MetricTableProps<T>) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columns.map(column => (
          <Text
            role="label"
            key={column.role}
            tone="secondary"
            align={column.role === 'name' ? undefined : 'right'}
            style={HEADER_STYLE[column.role]}
          >
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <ZebraTableRow key={rowKey(row, index)} alt={index % 2 === 0}>
          {columns.map(column => (
            <Text
              role="caption"
              key={column.role}
              align={column.role === 'name' ? undefined : 'right'}
              style={CELL_STYLE[column.role]}
              numberOfLines={column.role === 'name' ? 1 : undefined}
            >
              {column.value(row)}
            </Text>
          ))}
        </ZebraTableRow>
      ))}
    </View>
  );
}
