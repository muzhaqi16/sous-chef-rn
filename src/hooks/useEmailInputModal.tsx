import {useState, useMemo} from 'react';
import {EmailInputModal} from '#components';

export const useEmailInputModal = () => {
  const [visible, setVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    onSubmit: (email: string) => Promise<void> | void;
    title?: string;
    placeholder?: string;
  }>({
    onSubmit: () => {},
  });

  const show = (config: {
    onSubmit: (email: string) => Promise<void> | void;
    title?: string;
    placeholder?: string;
  }) => {
    setModalConfig(config);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  // Memoize the component to prevent recreation on every render
  const EmailModalComponent = useMemo(
    () => (
      <EmailInputModal
        visible={visible}
        onClose={hide}
        onSubmit={modalConfig.onSubmit}
        title={modalConfig.title}
        placeholder={modalConfig.placeholder}
      />
    ),
    [visible, modalConfig.onSubmit, modalConfig.title, modalConfig.placeholder],
  );

  return {
    show,
    hide,
    EmailModalComponent,
  };
};
