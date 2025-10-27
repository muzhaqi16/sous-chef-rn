import { useState, useMemo } from 'react';
import { InviteUserModal } from '#components/organisms/InviteUserModal';
import { MembershipRole } from '#generated';

export const useInviteUserModal = () => {
  const [visible, setVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
    title?: string;
  }>({
    onSubmit: async () => {},
  });

  const show = (config: {
    onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
    title?: string;
  }) => {
    setModalConfig(config);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  // Memoize the component to prevent recreation on every render
  const InviteModalComponent = useMemo(
    () => (
      <InviteUserModal
        visible={visible}
        onClose={hide}
        onSubmit={modalConfig.onSubmit}
        title={modalConfig.title}
      />
    ),
    [visible, modalConfig.onSubmit, modalConfig.title],
  );

  return {
    show,
    hide,
    InviteModalComponent,
  };
};
