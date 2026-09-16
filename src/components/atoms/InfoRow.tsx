import React from 'react';
import {
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, type IconTone } from '#/utils/iconUtils';
import { Text, type TextTone } from '#components/atoms/Text';

export interface InfoRowProps {
  label: string;

  value: string | number | null | undefined;

  /** Rendered after the value (e.g. 'kcal', 'minutes', 'g'). */
  unit?: string;

  formatter?: (value: string | number) => string;

  /** Default true. */
  showBorder?: boolean;

  labelStyle?: StyleProp<TextStyle>;

  /** Default `primary`. */
  labelTone?: TextTone;

  valueStyle?: StyleProp<TextStyle>;

  /** Default `secondary`; the default value text only, never `children`. */
  valueTone?: TextTone;

  containerStyle?: StyleProp<ViewStyle>;

  /** Append a colon after the label; default true. */
  showColon?: boolean;

  icon?: string;

  /** Default `textSecondary`. */
  iconTone?: IconTone;

  /** A static colour; wins over `iconTone`. */
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
  labelTone,
  valueStyle,
  valueTone = 'secondary',
  containerStyle,
  showColon = true,
  icon,
  iconTone = 'textSecondary',
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
    <Text role="bodyStrong" tone={valueTone} align="right" style={valueStyle}>
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
      <Text role="body" tone={labelTone} style={[styles.label, labelStyle]}>
        {label}
        {showColon ? ':' : ''}
      </Text>
      {icon ? (
        <View style={styles.valueWithIcon}>
          <View style={styles.iconContainer}>
            <Icon name={icon} size={16} color={iconColor} tone={iconTone} />
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
}));
