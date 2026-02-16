import React from 'react';
import {View} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
      <KeyboardAwareScrollView
        style={styles.form}
        bottomOffset={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardAwareScrollView>
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
