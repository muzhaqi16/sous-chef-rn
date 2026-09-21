import { unknownMember } from '#/utils/closedEnum';
import {
  CollaboratorRole,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import type { Icon } from '#utils/iconUtils';
import { safeParseDate } from '#utils/dateUtils';
import type { NotificationPayload } from '#features/notifications/types';
import type { Translate } from '#/i18n/types';
import type { TranslationKey } from '#/i18n';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { formatMonthDay } from '#/utils/formatters/date';

type IconProps = React.ComponentProps<typeof Icon>;

export const getNotificationAction = (
  type: NotificationType,
): { requiresAction: boolean; actionType?: string } => {
  switch (type) {
    case NotificationType.HomeInvitation:
    case NotificationType.MembershipInvite:
      return { requiresAction: true, actionType: 'ACCEPT_HOME_INVITE' };
    case NotificationType.CollaborationInvite:
      return {
        requiresAction: true,
        actionType: 'ACCEPT_SHOPPING_LIST_INVITE',
      };
    case NotificationType.ExpiryReminder:
      return { requiresAction: true, actionType: 'VIEW_EXPIRING_ITEMS' };
    case NotificationType.CollaborationAccepted:
    case NotificationType.CollaborationDeclined:
    case NotificationType.CollaboratorPermissionsUpdated:
    case NotificationType.CollaboratorRemoved:
    case NotificationType.CollaboratorRoleChanged:
    case NotificationType.HomeJoined:
    case NotificationType.ItemDeleted:
    case NotificationType.ItemUpdated:
    case NotificationType.ListUpdated:
    case NotificationType.LowStock:
    case NotificationType.NewItemAdded:
    case NotificationType.RecipeCooked:
    case NotificationType.RecipeSaved:
    default:
      return { requiresAction: false };
  }
};

export const getNotificationIcon = (
  type: NotificationType,
): IconProps['name'] => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return 'time';
    case NotificationType.LowStock:
      return 'cube';
    case NotificationType.NewItemAdded:
      return 'add-circle';
    case NotificationType.ItemUpdated:
      return 'create';
    case NotificationType.ItemDeleted:
      return 'trash';
    case NotificationType.MembershipInvite:
      return 'home';
    case NotificationType.CollaborationInvite:
      return 'person-add';
    case NotificationType.ListUpdated:
      return 'list';
    case NotificationType.HomeJoined:
      return 'people';
    case NotificationType.CollaborationAccepted:
    case NotificationType.CollaborationDeclined:
    case NotificationType.CollaboratorPermissionsUpdated:
    case NotificationType.CollaboratorRemoved:
    case NotificationType.CollaboratorRoleChanged:
    case NotificationType.HomeInvitation:
    case NotificationType.RecipeCooked:
    case NotificationType.RecipeSaved:
    default:
      return 'notifications';
  }
};

/**
 * Structured fields the server attaches to EXPIRY_REMINDER notification
 * payloads. The payload arrives as an untyped JSON scalar, so each field is
 * read defensively — a legacy payload missing them yields `null`.
 */
export interface ExpiryReminderFields {
  itemName: string;
  daysUntilExpiry: number;
  isMultiBatch: boolean;
  batchOpenedAt: string | null;
  batchAddedAt: string | null;
  // Always set by the server (see expirationCheckProcessor) for both the
  // batch-level and item-level reminder paths — unlike sourceId/sourceType,
  // which alias either PantryItem or PantryItemBatch depending on which path
  // fired, this is unambiguously the pantry item id.
  pantryItemId: string | null;
}

export const readExpiryReminderFields = (
  payload: NotificationPayload,
): ExpiryReminderFields | null => {
  const { daysUntilExpiry, pantryItemId } = payload;
  const itemName = readText(payload, 'itemName');
  if (itemName === null || typeof daysUntilExpiry !== 'number') {
    return null;
  }
  return {
    itemName,
    daysUntilExpiry,
    isMultiBatch: payload.isMultiBatch === true,
    batchOpenedAt:
      typeof payload.batchOpenedAt === 'string' ? payload.batchOpenedAt : null,
    batchAddedAt:
      typeof payload.batchAddedAt === 'string' ? payload.batchAddedAt : null,
    pantryItemId: typeof pantryItemId === 'string' ? pantryItemId : null,
  };
};

// Only qualify the item name when more than one active batch exists — otherwise
// the name alone is unambiguous. The qualifier uses the batch's opened date (or
// added date as a fallback), parsed and formatted in the device's local time so
// it isn't off by a day like the server's UTC-formatted plain-text message.
const buildExpiryName = (
  fields: ExpiryReminderFields,
  t: Translate,
): string => {
  if (!fields.isMultiBatch) {
    return fields.itemName;
  }
  const openedAt = fields.batchOpenedAt;
  const parsed = safeParseDate(openedAt ?? fields.batchAddedAt);
  if (!parsed) {
    return fields.itemName;
  }
  const date = formatMonthDay(parsed);
  return openedAt
    ? t('notifications.expiry.qualifierOpened', { name: fields.itemName, date })
    : t('notifications.expiry.qualifierAdded', { name: fields.itemName, date });
};

const buildExpiryReminderMessage = (
  payload: NotificationPayload,
  t: Translate,
): string | null => {
  const fields = readExpiryReminderFields(payload);
  if (!fields) {
    return null;
  }
  const name = buildExpiryName(fields, t);
  if (fields.daysUntilExpiry <= 0) {
    return t('notifications.expiry.expiresToday', { name });
  }
  if (fields.daysUntilExpiry === 1) {
    return t('notifications.expiry.expiresTomorrow', { name });
  }
  return t('notifications.expiry.expiresInDays', {
    name,
    days: fields.daysUntilExpiry,
  });
};

/**
 * What a notification says on screen, built from its `type` and structured
 * `payload`. The server's `title` and `message` are English in every locale,
 * so neither is read — unless `isAuthoredContent` says a person wrote them.
 */
export interface NotificationCopy {
  title: string;
  message: string;
}

/**
 * A notification as the copy builder reads it. `title` and `message` are the
 * server's, and only an authored row may show them.
 */
export interface NotificationCopySource {
  type: NotificationType;
  payload: NotificationPayload;
  isAuthoredContent?: boolean | null;
  title?: string | null;
  message?: string | null;
}

/** The names a digest shows before summarising the rest as a count. */
const DIGEST_NAME_CAP = 3;

// Push data arrives stringified and is re-coerced, so an all-digit name comes
// back a number; it is still the name.
const readText = (payload: NotificationPayload, key: string): string | null => {
  const value = payload[key];
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && text.trim() !== '' ? text : null;
};

const readNames = (payload: NotificationPayload, key: string): string[] => {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter(
        (name): name is string => typeof name === 'string' && name !== '',
      )
    : [];
};

const buildDigestMessage = (
  payload: NotificationPayload,
  t: Translate,
): string | null => {
  const names = readNames(payload, 'itemNames');
  const itemCount = payload.itemCount;
  const count = typeof itemCount === 'number' ? itemCount : names.length;
  if (count <= 0) return null;
  if (names.length === 0) {
    return t('notifications.copy.message.expiryDigestCount', { count });
  }
  const shown = names.slice(0, DIGEST_NAME_CAP).join(', ');
  const remainder = count - Math.min(DIGEST_NAME_CAP, names.length);
  return remainder > 0
    ? t('notifications.copy.message.expiryDigestMore', {
        names: shown,
        count: remainder,
      })
    : t('notifications.copy.message.expiryDigest', { names: shown, count });
};

const buildHomeInvitationMessage = (
  payload: NotificationPayload,
  t: Translate,
): string => {
  const inviterName = readText(payload, 'inviterName');
  const homeName = readText(payload, 'homeName');
  if (!homeName) return t('notifications.copy.message.homeInvitationGeneric');
  return inviterName
    ? t('notifications.copy.message.homeInvitation', { inviterName, homeName })
    : t('notifications.copy.message.homeInvitationNoInviter', { homeName });
};

const buildCollaborationInviteMessage = (
  payload: NotificationPayload,
  t: Translate,
): string => {
  const inviterName = readText(payload, 'inviterName');
  const listName = readText(payload, 'listName');
  if (!listName) {
    return t('notifications.copy.message.collaborationInviteGeneric');
  }
  return inviterName
    ? t('notifications.copy.message.collaborationInvite', {
        inviterName,
        listName,
      })
    : t('notifications.copy.message.collaborationInviteNoInviter', {
        listName,
      });
};

/**
 * The role names, keyed the same way the collaborator screens key them: one
 * concept, one string. `ADMIN` sits under `labels.*` because it names a
 * membership role too.
 */
const ROLE_LABEL: Record<CollaboratorRole, TranslationKey> = {
  [CollaboratorRole.Viewer]: 'collaboratorRoles.viewer',
  [CollaboratorRole.Shopper]: 'collaboratorRoles.shopper',
  [CollaboratorRole.Contributor]: 'collaboratorRoles.contributor',
  [CollaboratorRole.Editor]: 'collaboratorRoles.editor',
  [CollaboratorRole.Admin]: 'labels.admin',
  [CollaboratorRole.Owner]: 'collaboratorRoles.owner',
};

/** A payload role, named in the reader's language; null for one we cannot name. */
const readRole = (
  payload: NotificationPayload,
  key: string,
  t: Translate,
): string | null => {
  const value = readText(payload, key);
  // A wire string is not an enum member: a value this build predates has no
  // name here, and rendering it raw would show the reader `CONTRIBUTOR`.
  const label = Object.entries(ROLE_LABEL).find(([role]) => role === value);
  return label ? t(label[1]) : null;
};

/**
 * The role change, named when the payload says what it was. Falls back through
 * the wordings that need less, down to the one that names nothing.
 */
const buildRoleChangedMessage = (
  payload: NotificationPayload,
  t: Translate,
): string => {
  const name = readText(payload, 'changerName');
  const listName = readText(payload, 'listName');
  const role = readRole(payload, 'newRole', t);
  if (!name || !listName)
    return t('notifications.copy.message.collaboratorRoleChangedGeneric');
  if (!role)
    return t('notifications.copy.message.collaboratorRoleChanged', {
      name,
      listName,
    });
  const previousRole = readRole(payload, 'previousRole', t);
  return previousRole
    ? t('notifications.copy.message.collaboratorRoleChangedFromTo', {
        name,
        listName,
        previousRole,
        role,
      })
    : t('notifications.copy.message.collaboratorRoleChangedTo', {
        name,
        listName,
        role,
      });
};

const buildListUpdatedCopy = (
  payload: NotificationPayload,
  t: Translate,
): NotificationCopy => {
  const listName = readText(payload, 'listName');
  if (payload.eventType === 'complete') {
    return {
      title: t('notifications.copy.title.listCompleted'),
      message: listName
        ? t('notifications.copy.message.listCompleted', { listName })
        : t('notifications.copy.message.listCompletedGeneric'),
    };
  }
  return {
    title: t(`notifications.copy.title.${NotificationType.ListUpdated}`),
    message: listName
      ? t('notifications.copy.message.listUpdated', { listName })
      : t('notifications.copy.message.listUpdatedGeneric'),
  };
};

const buildLowStockMessage = (
  payload: NotificationPayload,
  t: Translate,
): string => {
  const itemName = readText(payload, 'itemName');
  if (!itemName) return t('notifications.copy.message.lowStockGeneric');
  const { currentQuantity } = payload;
  return typeof currentQuantity === 'number'
    ? t('notifications.copy.message.lowStock', {
        itemName,
        quantity: formatQuantityForDisplay(currentQuantity),
      })
    : t('notifications.copy.message.lowStockNoQuantity', { itemName });
};

/**
 * A message naming an actor and a list, e.g. "Ana removed you from Groceries";
 * the generic sentence when the payload lacks either name.
 */
const buildActorListMessage = (
  payload: NotificationPayload,
  actorKey: string,
  named: TranslationKey,
  generic: TranslationKey,
  t: Translate,
): string => {
  const name = readText(payload, actorKey);
  const listName = readText(payload, 'listName');
  return name && listName ? t(named, { name, listName }) : t(generic);
};

export const getNotificationCopy = (
  notification: NotificationCopySource,
  t: Translate,
): NotificationCopy => {
  const { type, payload } = notification;
  // An admin's announcement is content a person wrote, like a list's name —
  // not copy the server generated from a template. Shown as written, and only
  // on the server's own say-so: an empty payload does not make a row authored.
  if (notification.isAuthoredContent === true) {
    return {
      title: notification.title ?? t('notifications.copy.title.authored'),
      message: notification.message ?? '',
    };
  }
  if (payload.test === true) {
    return {
      title: t('notifications.copy.title.test'),
      message: t('notifications.copy.message.test'),
    };
  }
  const title = t(
    `notifications.copy.title.${
      type === NotificationType.MembershipInvite
        ? NotificationType.HomeInvitation
        : type
    }`,
  );
  switch (type) {
    case NotificationType.HomeInvitation:
    case NotificationType.MembershipInvite:
      return { title, message: buildHomeInvitationMessage(payload, t) };
    case NotificationType.CollaborationInvite:
      return { title, message: buildCollaborationInviteMessage(payload, t) };
    case NotificationType.CollaborationAccepted:
      return {
        title,
        message: buildActorListMessage(
          payload,
          'accepterName',
          'notifications.copy.message.collaborationAccepted',
          'notifications.copy.message.collaborationAcceptedGeneric',
          t,
        ),
      };
    case NotificationType.CollaborationDeclined:
      return {
        title,
        message: buildActorListMessage(
          payload,
          'declinerName',
          'notifications.copy.message.collaborationDeclined',
          'notifications.copy.message.collaborationDeclinedGeneric',
          t,
        ),
      };
    case NotificationType.CollaboratorRemoved:
      return {
        title,
        message: buildActorListMessage(
          payload,
          'removerName',
          'notifications.copy.message.collaboratorRemoved',
          'notifications.copy.message.collaboratorRemovedGeneric',
          t,
        ),
      };
    case NotificationType.CollaboratorRoleChanged:
      return { title, message: buildRoleChangedMessage(payload, t) };
    case NotificationType.CollaboratorPermissionsUpdated:
      return {
        title,
        message: buildActorListMessage(
          payload,
          'changerName',
          'notifications.copy.message.collaboratorPermissionsUpdated',
          'notifications.copy.message.collaboratorPermissionsUpdatedGeneric',
          t,
        ),
      };
    case NotificationType.ListUpdated:
      return buildListUpdatedCopy(payload, t);
    case NotificationType.LowStock:
      return { title, message: buildLowStockMessage(payload, t) };
    case NotificationType.ExpiryReminder: {
      const single = buildExpiryReminderMessage(payload, t);
      if (single) return { title, message: single };
      const digest = buildDigestMessage(payload, t);
      return digest
        ? { title: t('notifications.copy.title.expiryDigest'), message: digest }
        : { title, message: t('notifications.copy.message.expiryGeneric') };
    }
    case NotificationType.HomeJoined:
    case NotificationType.NewItemAdded:
    case NotificationType.ItemUpdated:
    case NotificationType.ItemDeleted:
    case NotificationType.RecipeSaved:
    case NotificationType.RecipeCooked:
      return { title, message: t(`notifications.copy.message.${type}`) };
    default: {
      unknownMember(type, 'notification type');
      // Its own words if the server sent any, never the lookup key the
      // template would render.
      return {
        title: notification.title ?? t('notifications.copy.title.unknown'),
        message: notification.message ?? '',
      };
    }
  }
};
