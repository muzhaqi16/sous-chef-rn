import { useState } from 'react';
import { InviteUserModal } from '#features/home/components/InviteUserModal';
import type { MembershipRole } from '#/graphql/generated/schemaTypes';

/** Resolves to the localized reason a refused invite was not sent, if any. */
type InviteSubmit = (
  email: string,
  role: MembershipRole,
) => Promise<string | null | void> | void;

export const useInviteUserModal = () => {
  const [visible, setVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    onSubmit: InviteSubmit;
    title?: string;
    allowedRoles?: MembershipRole[];
  }>({
    onSubmit: async () => {},
  });

  const show = (config: {
    onSubmit: InviteSubmit;
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
    InviteModalComponent,
  };
};
