import { useState } from 'react';
import { InviteUserModal } from '#features/home/components/InviteUserModal';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

export const useInviteUserModal = () => {
  const [visible, setVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
    title?: string;
    allowedRoles?: MembershipRole[];
  }>({
    onSubmit: async () => {},
  });

  const show = (config: {
    onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
    title?: string;
    allowedRoles?: MembershipRole[];
  }) => {
    setModalConfig(config);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  // Memoize the component to prevent recreation on every render
  const InviteModalComponent = (
    <InviteUserModal
      visible={visible}
      onClose={hide}
      onSubmit={modalConfig.onSubmit}
      title={modalConfig.title}
      allowedRoles={modalConfig.allowedRoles}
    />
  );

  return {
    show,
    hide,
    InviteModalComponent,
  };
};
