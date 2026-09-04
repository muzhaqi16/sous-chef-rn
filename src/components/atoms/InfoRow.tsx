import React from 'react';
import {
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface InfoRowProps {
  label: string;

  value: string | number | null | undefined;

  /** Rendered after the value (e.g. 'kcal', 'minutes', 'g'). */
  unit?: string;

  formatter?: (value: string | number) => string;

  /** Default true. */
  showBorder?: boolean;

  labelStyle?: StyleProp<TextStyle>;

  valueStyle?: StyleProp<TextStyle>;

  containerStyle?: StyleProp<ViewStyle>;

  /** Append a colon after the label; default true. */
  showColon?: boolean;

  icon?: string;

  /** Defaults to `textSecondary`. */
  iconColor?: string;

  /** Rendered instead of the default value text. */
  children?: React.ReactNode;
}

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
    <Text align="right" style={[commonStyles.subtitle, valueStyle]}>
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
        {label}
        {showColon ? ':' : ''}
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.divider,
  },
  label: {
    flex: 1,
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
