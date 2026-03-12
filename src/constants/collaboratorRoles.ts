import { CollaboratorRole } from '#generated';

export interface RoleInfo {
  label: string;
  description: string;
  icon: string;
  permissions: Array<{ label: string; granted: boolean }>;
}

export const ROLE_PERMISSIONS: Record<CollaboratorRole, RoleInfo> = {
  [CollaboratorRole.Viewer]: {
    label: 'Viewer',
    description: 'Can view the shopping list',
    icon: '👁️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: false },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Mark purchased', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Shopper]: {
    label: 'Shopper',
    description: 'Can mark items as purchased',
    icon: '🛒',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Add items', granted: false },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Contributor]: {
    label: 'Contributor',
    description: 'Can add items and mark as purchased',
    icon: '✏️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Edit items', granted: false },
      { label: 'Remove items', granted: false },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Editor]: {
    label: 'Editor',
    description: 'Can add, edit, and remove items',
    icon: '📝',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: false },
    ],
  },
  [CollaboratorRole.Admin]: {
    label: 'Admin',
    description: 'Full control including inviting others',
    icon: '⚙️',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: true },
    ],
  },
  [CollaboratorRole.Owner]: {
    label: 'Owner',
    description: 'Full control over the shopping list',
    icon: '👑',
    permissions: [
      { label: 'View items', granted: true },
      { label: 'View history', granted: true },
      { label: 'Export list', granted: true },
      { label: 'Add items', granted: true },
      { label: 'Edit items', granted: true },
      { label: 'Remove items', granted: true },
      { label: 'Mark purchased', granted: true },
      { label: 'Invite others', granted: true },
    ],
  },
};

/** Roles available when inviting collaborators (excludes Owner) */
export const INVITE_ROLES = [
  CollaboratorRole.Viewer,
  CollaboratorRole.Shopper,
  CollaboratorRole.Contributor,
  CollaboratorRole.Editor,
  CollaboratorRole.Admin,
];
