import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface FieldRowProps {
  children: React.ReactNode;
  gap?: number;
  containerStyle?: ViewStyle;
}

/**
 * FieldRow - A horizontal layout wrapper for form fields
 *
 * Places children side-by-side with equal flex distribution.
 * Useful for grouping related fields like Quantity + Unit.
 * Applies consistent bottom margin for spacing between rows.
 *
 * @example
 * <FieldRow>
 *   <FormInput label="Quantity" />
 *   <FormInput label="Unit" />
 * </FieldRow>
 */
export const FieldRow: React.FC<FieldRowProps> = ({
  children,
  gap = 12,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, { gap }, containerStyle]}>
      {React.Children.map(children, child =>
        child ? <View style={styles.field}>{child}</View> : null,
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align at top so labels line up
    marginBottom: theme.spacing.md, // Consistent spacing between rows
  },
  field: {
    flex: 1,
  },
}));
