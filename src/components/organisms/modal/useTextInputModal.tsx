import React, {useState, useMemo} from 'react';
import {TextInputProps} from 'react-native';
import {TextInputModal} from './TextInputModal';
import {ValidationRule} from './types';

// Hook for managing the modal state programmatically
export const useTextInputModal = () => {
  const [visible, setVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    onSubmit: (text: string) => Promise<void> | void;
    title?: string;
    placeholder?: string;
    submitText?: string;
    initialValue?: string;
    validationRules?: ValidationRule[];
    textInputProps?: Partial<TextInputProps>;
    multiline?: boolean;
  }>({
    onSubmit: () => {},
  });

  const show = (config: {
    onSubmit: (text: string) => Promise<void> | void;
    title?: string;
    placeholder?: string;
    submitText?: string;
    initialValue?: string;
    validationRules?: ValidationRule[];
    textInputProps?: Partial<TextInputProps>;
    multiline?: boolean;
  }) => {
    setModalConfig(config);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  const TextModalComponent = useMemo(
    () => <TextInputModal visible={visible} onClose={hide} {...modalConfig} />,
    [visible, modalConfig.onSubmit, modalConfig.title, modalConfig.placeholder],
  );

  return {
    show,
    hide,
    TextModalComponent,
  };
};
