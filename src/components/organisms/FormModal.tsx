import React from 'react';
import {View, ScrollView} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Header} from '../molecules/Header';

interface FormModalProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  loading?: boolean;
  children: React.ReactNode;
  testID?: string;
  submitButtonTestID?: string;
}

export const FormModal: React.FC<FormModalProps> = ({
  title,
  onClose,
  onSave,
  loading = false,
  children,
  testID,
  submitButtonTestID,
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <Header
        title={title}
        centerTitle
        leftActions={[
          {
            icon: 'close',
            onPress: onClose,
            disabled: loading,
          },
        ]}
        rightActions={[
          {
            icon: 'check',
            onPress: onSave,
            loading: loading,
            disabled: loading,
            testID: submitButtonTestID,
          },
        ]}
      />
      <ScrollView style={styles.form}>{children}</ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 12,
  },
  form: {
    padding: 16,
  },
}));
