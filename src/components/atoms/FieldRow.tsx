import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface FieldRowProps {
  children: React.ReactNode;
  gap?: number;
  containerStyle?: ViewStyle;
}

/**
 * Side-by-side form fields with equal flex. No bottom margin of its own: each
 * field carries one, and a second here double-spaces the row.
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align at top so labels line up
  },
  field: {
    flex: 1,
  },
});
