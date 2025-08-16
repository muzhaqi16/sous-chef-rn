import {TextInputProps} from 'react-native';

export interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

export interface TextInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void> | void;
  title?: string;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
  primaryColor?: string;
  errorColor?: string;
  loading?: boolean;
  initialValue?: string;
  validationRules?: ValidationRule[];
  textInputProps?: Partial<TextInputProps>;
  multiline?: boolean;
}
