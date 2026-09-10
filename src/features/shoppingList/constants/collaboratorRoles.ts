import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import type { IconName } from '#utils/iconUtils';

/**
 * i18n key paths, not display strings — this table is module-level and cannot
 * call a hook. The `*Key` names are deliberate: rendering one raw is then a
 * visibly wrong string rather than a silently English one.
 */
export interface RoleInfo {
  labelKey: string;
  descriptionKey: string;
  icon: IconName;
  permissions: Array<{ labelKey: string; granted: boolean }>;
}

export const ROLE_PERMISSIONS: Record<CollaboratorRole, RoleInfo> = {
  [CollaboratorRole.Viewer]: {
    labelKey: 'collaboratorRoles.viewer',
    descriptionKey: 'collaboratorRoles.descriptions.viewer',
    icon: 'eye-outline',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: false },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: false },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: false },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: false,
      },
      {
        labelKey: 'collaboratorRoles.permissions.inviteOthers',
        granted: false,
      },
    ],
  },
  [CollaboratorRole.Shopper]: {
    labelKey: 'collaboratorRoles.shopper',
    descriptionKey: 'collaboratorRoles.descriptions.shopper',
    icon: 'cart-outline',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: true,
      },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: false },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: false },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: false },
      {
        labelKey: 'collaboratorRoles.permissions.inviteOthers',
        granted: false,
      },
    ],
  },
  [CollaboratorRole.Contributor]: {
    labelKey: 'collaboratorRoles.contributor',
    descriptionKey: 'collaboratorRoles.descriptions.contributor',
    icon: 'add-circle-outline',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: true },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: true,
      },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: false },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: false },
      {
        labelKey: 'collaboratorRoles.permissions.inviteOthers',
        granted: false,
      },
    ],
  },
  [CollaboratorRole.Editor]: {
    labelKey: 'collaboratorRoles.editor',
    descriptionKey: 'collaboratorRoles.descriptions.editor',
    icon: 'create-outline',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: true },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: true,
      },
      {
        labelKey: 'collaboratorRoles.permissions.inviteOthers',
        granted: false,
      },
    ],
  },
  [CollaboratorRole.Admin]: {
    labelKey: 'labels.admin',
    descriptionKey: 'collaboratorRoles.descriptions.admin',
    icon: 'settings-outline',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: true },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: true,
      },
      { labelKey: 'collaboratorRoles.permissions.inviteOthers', granted: true },
    ],
  },
  [CollaboratorRole.Owner]: {
    labelKey: 'collaboratorRoles.owner',
    descriptionKey: 'collaboratorRoles.descriptions.owner',
    icon: 'star',
    permissions: [
      { labelKey: 'collaboratorRoles.permissions.viewItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.viewHistory', granted: true },
      { labelKey: 'collaboratorRoles.permissions.exportList', granted: true },
      { labelKey: 'collaboratorRoles.permissions.addItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.editItems', granted: true },
      { labelKey: 'collaboratorRoles.permissions.removeItems', granted: true },
      {
        labelKey: 'collaboratorRoles.permissions.markPurchased',
        granted: true,
      },
      { labelKey: 'collaboratorRoles.permissions.inviteOthers', granted: true },
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
