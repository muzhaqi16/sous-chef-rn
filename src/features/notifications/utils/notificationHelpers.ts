import { unknownMember } from '#/utils/closedEnum';
import {
  CollaboratorRole,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import { isDateKey, safeParseDate } from '#utils/dateUtils';
import type { NotificationCopyData } from '#features/notifications/types';
import type { Translate } from '#/i18n/types';
import {
  daysUntilExpiry as daysUntilExpiryOn,
  expiryLabel,
} from '#domain/expiry';
import type { TranslationKey } from '#/i18n';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { formatMonthDay, formatTimeOfDay } from '#/utils/formatters/date';
import { cappedNames } from '#/utils/cappedNames';

export const getNotificationAction = (
  type: NotificationType,
  /**
   * The stack the server names for the notification now. Null offers no stack
   * action, since there is nothing for it to act on; absent predates the field.
   */
  pantryItemId?: string | null,
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
      return pantryItemId === null
        ? { requiresAction: false }
        : { requiresAction: true, actionType: 'VIEW_EXPIRING_ITEMS' };
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
    case NotificationType.RunningLow:
    case NotificationType.NewItemAdded:
    case NotificationType.RecipeCooked:
    case NotificationType.RecipeSaved:
    case NotificationType.ListReminder:
    case NotificationType.SharedListChanged:
    case NotificationType.MealPlanReminder:
    case NotificationType.CookingReminder:
    case NotificationType.RecipeRecommendations:
    case NotificationType.WeeklyDigest:
    case NotificationType.MonthlyReport:
    default:
      return { requiresAction: false };
  }
};

type CopyTypename = NotificationCopyData['__typename'];
type CopyMember<Typename extends CopyTypename> = Extract<
  NotificationCopyData,
  { __typename: Typename }
>;

const isMember = <Typename extends CopyTypename>(
  data: NotificationCopyData | null,
  typename: Typename,
): data is CopyMember<Typename> => data?.__typename === typename;

/** The member of `data` that `typename` names; null for any other. */
const memberOf = <Typename extends CopyTypename>(
  data: NotificationCopyData | null,
  typename: Typename,
): CopyMember<Typename> | null => (isMember(data, typename) ? data : null);

/** Text to show; null for none or a blank one. */
const shownText = (value: string | null | undefined): string | null =>
  value?.trim() ? value : null;

const shownNames = (names: readonly string[] | undefined): string[] =>
  (names ?? []).filter(name => name !== '');

const namesOf = (named: readonly { name?: string }[] | undefined): string[] =>
  shownNames(named?.flatMap(({ name }) => name ?? []));

interface ExpiryReminderFields {
  itemName: string;
  daysUntilExpiry: number;
  isMultiBatch: boolean;
  batchOpenedAt: string | null;
  batchAddedAt: string | null;
}

const readExpiryReminderFields = (
  data: NotificationCopyData | null,
  today: string,
): ExpiryReminderFields | null => {
  const reminder = memberOf(data, 'ExpiryReminderNotificationData');
  const itemName = shownText(reminder?.itemName);
  if (!reminder || itemName === null) return null;
  const { expiresOn } = reminder;
  // The date is counted on this phone, so an old reminder in the feed does not
  // keep the day count it was sent with. A push carries only the count.
  const daysUntilExpiry =
    expiresOn && isDateKey(expiresOn)
      ? daysUntilExpiryOn(expiresOn, today)
      : reminder.daysUntilExpiry;
  if (daysUntilExpiry === undefined) return null;
  return {
    itemName,
    daysUntilExpiry,
    isMultiBatch: reminder.isMultiBatch === true,
    batchOpenedAt: reminder.batchOpenedAt ?? null,
    batchAddedAt: reminder.batchAddedAt ?? null,
  };
};

// Qualified only when more than one batch is active, by the batch's opened
// (else added) date in device-local time: the server's UTC-formatted message
// can be off by a day.
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
  data: NotificationCopyData | null,
  t: Translate,
  today: string,
): string | null => {
  const fields = readExpiryReminderFields(data, today);
  if (!fields) {
    return null;
  }
  return t('notifications.expiry.reminder', {
    name: buildExpiryName(fields, t),
    status: expiryLabel(fields.daysUntilExpiry, t),
  });
};

/**
 * What a notification says on screen, built from its `type` and typed
 * `data`. The server's `title` and `message` are English in every locale,
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
  /** Null for a row with no typed payload. */
  data: NotificationCopyData | null;
  /** A test the user sent themselves, which has no typed payload. */
  isTest?: boolean;
  isAuthoredContent?: boolean | null;
  title?: string | null;
  message?: string | null;
}

/** The names a digest shows before summarising the rest as a count. */
const DIGEST_NAME_CAP = 3;

const buildDigestMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string | null => {
  const digest = memberOf(data, 'ExpiryDigestNotificationData');
  const names = namesOf(digest?.items);
  const count = digest?.itemCount ?? names.length;
  if (count <= 0) return null;
  if (names.length === 0) {
    return t('notifications.copy.message.expiryDigestCount', { count });
  }
  const { shown, remainder } = cappedNames(names, count);
  return remainder > 0
    ? t('notifications.copy.message.expiryDigestMore', {
        names: shown,
        count: remainder,
      })
    : t('notifications.copy.message.expiryDigest', { names: shown, count });
};

const buildHomeInvitationMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const invitation = memberOf(data, 'HomeInvitationNotificationData');
  const inviterName = shownText(invitation?.inviterName);
  const homeName = shownText(invitation?.homeName);
  if (!homeName) return t('notifications.copy.message.homeInvitationGeneric');
  return inviterName
    ? t('notifications.copy.message.homeInvitation', { inviterName, homeName })
    : t('notifications.copy.message.homeInvitationNoInviter', { homeName });
};

const buildCollaborationInviteMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const invitation = memberOf(data, 'CollaborationInviteNotificationData');
  const inviterName = shownText(invitation?.inviterName);
  const listName = shownText(invitation?.listName);
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
  [CollaboratorRole.Owner]: 'labels.owner',
};

/**
 * A role, named in the reader's language; null for one we cannot name. A role
 * this build predates arrives all the same, so it is read as the string it is:
 * rendering it raw would show the reader `CONTRIBUTOR`.
 */
const roleName = (role: string | undefined, t: Translate): string | null => {
  const label = Object.entries(ROLE_LABEL).find(([known]) => known === role);
  return label ? t(label[1]) : null;
};

/**
 * The role change, named when the data says what it was. Falls back through
 * the wordings that need less, down to the one that names nothing.
 */
const buildRoleChangedMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const change = memberOf(data, 'CollaboratorRoleChangedNotificationData');
  const name = shownText(change?.changerName);
  const listName = shownText(change?.listNameIfKnown);
  const role = roleName(change?.newRole, t);
  if (!name || !listName)
    return t('notifications.copy.message.collaboratorRoleChangedGeneric');
  if (!role)
    return t('notifications.copy.message.collaboratorRoleChanged', {
      name,
      listName,
    });
  const previousRole = roleName(change?.previousRole, t);
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
  data: NotificationCopyData | null,
  t: Translate,
): NotificationCopy => {
  const update = memberOf(data, 'ListUpdatedNotificationData');
  const listName = shownText(update?.listName);
  if (update?.eventType === 'complete') {
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
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const alert = memberOf(data, 'LowStockNotificationData');
  const itemName = shownText(alert?.itemName);
  if (!itemName) return t('notifications.copy.message.lowStockGeneric');
  const currentQuantity = alert?.currentQuantity;
  return currentQuantity === undefined
    ? t('notifications.copy.message.lowStockNoQuantity', { itemName })
    : t('notifications.copy.message.lowStock', {
        itemName,
        quantity: formatQuantityForDisplay(currentQuantity),
      });
};

/**
 * A message naming an actor and a list, e.g. "Ana removed you from Groceries";
 * the generic sentence when the data lacks either name.
 */
const buildActorListMessage = (
  actorName: string | undefined,
  listName: string | null | undefined,
  named: TranslationKey,
  generic: TranslationKey,
  t: Translate,
): string => {
  const name = shownText(actorName);
  const list = shownText(listName);
  return name && list ? t(named, { name, listName: list }) : t(generic);
};

/**
 * "Ana", "Ana and Ben", "Ana, Ben and 2 others". `total` counts names a push
 * trimmed to fit its size budget, so the remainder stays true.
 */
const joinNames = (
  names: string[],
  total: number,
  t: Translate,
): string | null => {
  const shown = names.slice(0, DIGEST_NAME_CAP);
  // No name to lead with: the caller counts instead.
  if (shown.length === 0) return null;
  const remainder = Math.max(total, names.length) - shown.length;
  if (remainder > 0) {
    return t('notifications.copy.names.andMore', {
      names: shown.join(', '),
      count: remainder,
    });
  }
  const last = shown[shown.length - 1];
  if (last === undefined) return null;
  const head = shown.slice(0, -1);
  return head.length === 0
    ? last
    : t('notifications.copy.names.and', { names: head.join(', '), last });
};

type PantryChangeType =
  | NotificationType.NewItemAdded
  | NotificationType.ItemUpdated
  | NotificationType.ItemDeleted;

/**
 * One item by name, or several by count. Pluralized on the number of people who
 * made the change: the verb agrees with them in es, it and sq.
 */
const PANTRY_CHANGE_COPY: Readonly<
  Record<PantryChangeType, { one: TranslationKey; many: TranslationKey }>
> = {
  [NotificationType.NewItemAdded]: {
    one: 'notifications.copy.message.pantryAdded',
    many: 'notifications.copy.message.pantryAddedMany',
  },
  [NotificationType.ItemUpdated]: {
    one: 'notifications.copy.message.pantryUpdated',
    many: 'notifications.copy.message.pantryUpdatedMany',
  },
  [NotificationType.ItemDeleted]: {
    one: 'notifications.copy.message.pantryRemoved',
    many: 'notifications.copy.message.pantryRemovedMany',
  },
};

const buildPantryChangeMessage = (
  type: PantryChangeType,
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const change = memberOf(data, 'PantryChangeNotificationData');
  const pantryName = shownText(change?.pantryName);
  const actorNames = shownNames(change?.actorNames);
  const names = joinNames(actorNames, actorNames.length, t);
  const itemNames = namesOf(change?.items);
  const itemCount = change?.itemCount ?? itemNames.length;
  const [itemName] = itemNames;
  const generic = t(`notifications.copy.message.${type}`);
  if (!pantryName || !names) return generic;
  const count = actorNames.length;
  if (itemCount > 1) {
    return t(PANTRY_CHANGE_COPY[type].many, {
      names,
      count,
      itemCount,
      pantryName,
    });
  }
  return itemName
    ? t(PANTRY_CHANGE_COPY[type].one, { names, count, itemName, pantryName })
    : generic;
};

const buildRunningLowMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const prediction = memberOf(data, 'RunningLowNotificationData');
  const itemNames = namesOf(prediction?.items);
  const itemCount = prediction?.itemCount ?? itemNames.length;
  const names = joinNames(itemNames, itemCount, t);
  if (names) {
    return t('notifications.copy.message.runningLow', {
      names,
      count: Math.max(itemCount, itemNames.length),
    });
  }
  return itemCount > 0
    ? t('notifications.copy.message.runningLowCount', { count: itemCount })
    : t('notifications.copy.message.runningLowGeneric');
};

const buildListReminderMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const reminder = memberOf(data, 'ListReminderNotificationData');
  const listName = shownText(reminder?.listName);
  if (!listName) return t('notifications.copy.message.listReminderGeneric');
  const count = reminder?.itemCount ?? 0;
  return count > 0
    ? t('notifications.copy.message.listReminder', { listName, count })
    : t('notifications.copy.message.listReminderEmpty', { listName });
};

const buildSharedListChangedMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const change = memberOf(data, 'SharedListChangedNotificationData');
  const listName = shownText(change?.listName);
  if (!listName) return t('notifications.copy.message.listUpdatedGeneric');
  const actorNames = shownNames(change?.actorNames);
  const names = joinNames(actorNames, actorNames.length, t);
  return names
    ? t('notifications.copy.message.sharedListChanged', {
        names,
        count: actorNames.length,
        listName,
      })
    : t('notifications.copy.message.sharedListChangedNoActor', { listName });
};

const buildMealPlanReminderMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const reminder = memberOf(data, 'MealPlanReminderNotificationData');
  const mealNames = namesOf(reminder?.meals);
  const mealCount = reminder?.mealCount ?? mealNames.length;
  const names = joinNames(mealNames, mealCount, t);
  if (names) return t('notifications.copy.message.mealPlanReminder', { names });
  return mealCount > 0
    ? t('notifications.copy.message.mealPlanReminderCount', {
        count: mealCount,
      })
    : t('notifications.copy.message.mealPlanReminderGeneric');
};

/** "18:30" as the reader's clock shows it; null for a time it cannot read. */
const readMealTime = (mealTime: string | undefined): string | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(mealTime ?? '');
  if (!match) return null;
  const at = new Date();
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return formatTimeOfDay(at);
};

const buildCookingReminderMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const reminder = memberOf(data, 'CookingReminderNotificationData');
  const recipeName = shownText(reminder?.recipeName);
  if (!recipeName)
    return t('notifications.copy.message.cookingReminderGeneric');
  const time = readMealTime(reminder?.mealTime);
  return time
    ? t('notifications.copy.message.cookingReminder', { recipeName, time })
    : t('notifications.copy.message.cookingReminderNoTime', { recipeName });
};

const buildRecipeRecommendationsMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const recommendation = memberOf(
    data,
    'RecipeRecommendationsNotificationData',
  );
  const recipeNames = namesOf(recommendation?.recipes);
  const recipeCount = recommendation?.recipeCount ?? recipeNames.length;
  const names = joinNames(recipeNames, recipeCount, t);
  if (names) {
    return t('notifications.copy.message.recipeRecommendations', { names });
  }
  return recipeCount > 0
    ? t('notifications.copy.message.recipeRecommendationsCount', {
        count: recipeCount,
      })
    : t('notifications.copy.message.recipeRecommendationsGeneric');
};

type CountPart = readonly [count: number | undefined, copy: TranslationKey];

/** A summary's non-zero figures, each worded with its own count, in order. */
const buildCountsMessage = (
  parts: readonly CountPart[],
  generic: TranslationKey,
  t: Translate,
): string => {
  const worded = parts.flatMap(([count, copy]) =>
    count !== undefined && count > 0 ? [t(copy, { count })] : [],
  );
  return worded.length > 0 ? worded.join(', ') : t(generic);
};

const buildWeeklyDigestMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const digest = memberOf(data, 'PantryWeeklyDigestNotificationData');
  return buildCountsMessage(
    [
      [digest?.itemsAdded, 'notifications.copy.message.weeklyDigestAdded'],
      [digest?.itemsUsed, 'notifications.copy.message.weeklyDigestUsed'],
      [digest?.itemsWasted, 'notifications.copy.message.weeklyDigestWasted'],
      [
        digest?.itemsExpiringSoon,
        'notifications.copy.message.weeklyDigestExpiring',
      ],
    ],
    'notifications.copy.message.weeklyDigestGeneric',
    t,
  );
};

const buildMonthlyReportMessage = (
  data: NotificationCopyData | null,
  t: Translate,
): string => {
  const report = memberOf(data, 'MonthlyReportNotificationData');
  return buildCountsMessage(
    [
      [
        report?.purchaseCount,
        'notifications.copy.message.monthlyReportPurchases',
      ],
      [
        report?.recipesCooked,
        'notifications.copy.message.monthlyReportRecipesCooked',
      ],
      [
        report?.wastedItemCount,
        'notifications.copy.message.monthlyReportWasted',
      ],
    ],
    'notifications.copy.message.monthlyReportGeneric',
    t,
  );
};

export const getNotificationCopy = (
  notification: NotificationCopySource,
  t: Translate,
  today: string,
): NotificationCopy => {
  const { type, data } = notification;
  // An admin's announcement is content a person wrote, like a list's name —
  // not copy the server generated from a template. Shown as written, and only
  // on the server's own say-so: a row with no data is not authored for that.
  if (notification.isAuthoredContent === true) {
    return {
      title: notification.title ?? t('notifications.copy.title.authored'),
      message: notification.message ?? '',
    };
  }
  if (notification.isTest === true) {
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
      return { title, message: buildHomeInvitationMessage(data, t) };
    case NotificationType.CollaborationInvite:
      return { title, message: buildCollaborationInviteMessage(data, t) };
    case NotificationType.CollaborationAccepted: {
      const accepted = memberOf(data, 'CollaborationAcceptedNotificationData');
      return {
        title,
        message: buildActorListMessage(
          accepted?.accepterName,
          accepted?.listName,
          'notifications.copy.message.collaborationAccepted',
          'notifications.copy.message.collaborationAcceptedGeneric',
          t,
        ),
      };
    }
    case NotificationType.CollaborationDeclined: {
      const declined = memberOf(data, 'CollaborationDeclinedNotificationData');
      return {
        title,
        message: buildActorListMessage(
          declined?.declinerName,
          declined?.listName,
          'notifications.copy.message.collaborationDeclined',
          'notifications.copy.message.collaborationDeclinedGeneric',
          t,
        ),
      };
    }
    case NotificationType.CollaboratorRemoved: {
      const removal = memberOf(data, 'CollaboratorRemovedNotificationData');
      return {
        title,
        message: buildActorListMessage(
          removal?.removerName,
          removal?.listNameIfKnown,
          'notifications.copy.message.collaboratorRemoved',
          'notifications.copy.message.collaboratorRemovedGeneric',
          t,
        ),
      };
    }
    case NotificationType.CollaboratorRoleChanged:
      return { title, message: buildRoleChangedMessage(data, t) };
    case NotificationType.CollaboratorPermissionsUpdated: {
      const change = memberOf(
        data,
        'CollaboratorPermissionsUpdatedNotificationData',
      );
      return {
        title,
        message: buildActorListMessage(
          change?.changerName,
          change?.listNameIfKnown,
          'notifications.copy.message.collaboratorPermissionsUpdated',
          'notifications.copy.message.collaboratorPermissionsUpdatedGeneric',
          t,
        ),
      };
    }
    case NotificationType.ListUpdated:
      return buildListUpdatedCopy(data, t);
    case NotificationType.LowStock:
      return { title, message: buildLowStockMessage(data, t) };
    case NotificationType.RunningLow:
      return { title, message: buildRunningLowMessage(data, t) };
    case NotificationType.ExpiryReminder: {
      const single = buildExpiryReminderMessage(data, t, today);
      if (single) return { title, message: single };
      const digest = buildDigestMessage(data, t);
      return digest
        ? { title: t('notifications.copy.title.expiryDigest'), message: digest }
        : { title, message: t('notifications.copy.message.expiryGeneric') };
    }
    case NotificationType.NewItemAdded:
    case NotificationType.ItemUpdated:
    case NotificationType.ItemDeleted:
      return { title, message: buildPantryChangeMessage(type, data, t) };
    case NotificationType.ListReminder:
      return { title, message: buildListReminderMessage(data, t) };
    case NotificationType.SharedListChanged:
      return { title, message: buildSharedListChangedMessage(data, t) };
    case NotificationType.MealPlanReminder:
      return { title, message: buildMealPlanReminderMessage(data, t) };
    case NotificationType.CookingReminder:
      return { title, message: buildCookingReminderMessage(data, t) };
    case NotificationType.RecipeRecommendations:
      return { title, message: buildRecipeRecommendationsMessage(data, t) };
    case NotificationType.WeeklyDigest:
      return { title, message: buildWeeklyDigestMessage(data, t) };
    case NotificationType.MonthlyReport:
      return { title, message: buildMonthlyReportMessage(data, t) };
    case NotificationType.HomeJoined:
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

/** `payload` read where a row has no typed `data`: a test, an authored row. */
const payloadValue = (payload: JsonValue, key: string): unknown =>
  typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload[key]
    : undefined;

/** A test the user sent themselves. */
export const isTestNotification = (payload: JsonValue): boolean =>
  payloadValue(payload, 'test') === true;

/** The details an authored row's author attached; null for none. */
export const authoredDetails = (payload: JsonValue): string | null => {
  const details = payloadValue(payload, 'details');
  return typeof details === 'string' && details !== '' ? details : null;
};
