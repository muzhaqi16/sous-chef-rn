import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils/iconUtils';

export interface InfoRowProps {
  /**
   * The label text (left side)
   */
  label: string;

  /**
   * The value to display (right side)
   */
  value: string | number | null | undefined;

  /**
   * Optional unit to display after the value (e.g., 'kcal', 'minutes', 'g')
   */
  unit?: string;

  /**
   * Optional custom formatter for the value
   */
  formatter?: (value: any) => string;

  /**
   * Show a bottom border (default: true)
   */
  showBorder?: boolean;

  /**
   * Custom label style
   */
  labelStyle?: any;

  /**
   * Custom value style
   */
  valueStyle?: any;

  /**
   * Custom container style
   */
  containerStyle?: any;

  /**
   * Append a colon after the label (default: true)
   */
  showColon?: boolean;

  /**
   * Optional Ionicon name to display before the value
   */
  icon?: string;

  /**
   * Custom icon color (defaults to theme textSecondary)
   */
  iconColor?: string;

  /**
   * Optional children to render instead of the default value text
   */
  children?: React.ReactNode;
}

/**
 * InfoRow - A reusable component for displaying key-value pairs
 *
 * Standardizes the label/value display pattern used across settings screens,
 * profile displays, and detail views throughout the app.
 *
 * @example Basic usage
 * ```tsx
 * <InfoRow label="Meals per day" value={3} />
 * ```
 *
 * @example With unit
 * ```tsx
 * <InfoRow label="Max Prep Time" value={30} unit="minutes" />
 * ```
 *
 * @example With custom formatter
 * ```tsx
 * <InfoRow
 *   label="Budget per Meal"
 *   value={15.50}
 *   formatter={(val) => `$${val.toFixed(2)}`}
 * />
 * ```
 *
 * @example Currency with unit
 * ```tsx
 * <InfoRow label="Price" value={25} unit="USD" formatter={(v) => `$${v}`} />
 * ```
 */
export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  unit,
  formatter,
  showBorder = true,
  labelStyle,
  valueStyle,
  containerStyle,
  showColon = true,
  icon,
  iconColor,
  children,
}) => {
  let formattedValue: string;
  if (value === null || value === undefined) {
    formattedValue = '—'; // Em dash for empty values
  } else if (formatter) {
    formattedValue = formatter(value);
  } else {
    // Default formatting
    const stringValue = String(value);
    formattedValue = unit ? `${stringValue} ${unit}` : stringValue;
  }

  const valueContent = children ?? (
    <Text style={[commonStyles.subtitle, styles.value, valueStyle]}>
      {formattedValue}
    </Text>
  );

  return (
    <View
      style={[
        styles.container,
        showBorder && styles.withBorder,
        containerStyle,
      ]}
    >
      <Text style={[commonStyles.body, styles.label, labelStyle]}>
        {label}{showColon ? ':' : ''}
      </Text>
      {icon ? (
        <View style={styles.valueWithIcon}>
          <View style={styles.iconContainer}>
            <Icon
              name={icon}
              size={16}
              color={iconColor ?? styles.iconDefaultColor.color}
            />
          </View>
          {valueContent}
        </View>
      ) : (
        valueContent
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  withBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  label: {
    flex: 1,
  },
  value: {
    textAlign: 'right',
  },
  valueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: theme.spacing.xs,
  },
  iconDefaultColor: {
    color: theme.colors.textSecondary,
  },
}));
