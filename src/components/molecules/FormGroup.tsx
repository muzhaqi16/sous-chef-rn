import React from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface FormGroupProps {
  children: React.ReactNode;
  row?: boolean;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  row = false,
}) => {
  return <View style={[styles.container, row && styles.row]}>{children}</View>;
};

const styles = StyleSheet.create(() => ({
  container: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
}));
