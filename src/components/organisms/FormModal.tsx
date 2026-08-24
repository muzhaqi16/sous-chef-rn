import React from 'react';
import { View } from 'react-native';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Header } from '../molecules/Header';

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
            icon: 'checkmark',
            onPress: onSave,
            loading: loading,
            disabled: loading,
            testID: submitButtonTestID,
          },
        ]}
      />
      <ThemedKeyboardAwareScrollView
        style={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ThemedKeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing['3'],
  },
  form: {
    padding: theme.spacing.md,
  },
}));
