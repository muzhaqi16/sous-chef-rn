/**
 * Tray copy for a delivered push, in the reader's language.
 *
 * The public entry the push service calls: a push arrives as a flat map of
 * strings, and `getNotificationCopy` reads typed data, so the coercion lives
 * here rather than in either. The wording itself stays in the one copy
 * builder the in-app feed uses — a second table would diverge the first time
 * either was translated.
 */

import {
  CollaboratorRole,
  NotificationType,
} from '#/graphql/generated/schemaTypes';
import type { NotificationCopyData } from '#features/notifications/types';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';
import type { Translate } from '#/i18n/types';
import { todayKey } from '#/utils/dateUtils';

/**
 * A wire string is not an enum member, so a value this build predates has to
 * be recognized as unknown rather than asserted into the enum. Keyed by the
 * wire spelling, which is the enum's own value.
 */
const byValue = <Member extends string>(members: Member[]) =>
  new Map<string, Member>(members.map(member => [member, member]));

const NOTIFICATION_TYPE_BY_VALUE = byValue(Object.values(NotificationType));
const COLLABORATOR_ROLE_BY_VALUE = byValue(Object.values(CollaboratorRole));

const readType = (value: string | undefined): NotificationType | null =>
  (value === undefined ? undefined : NOTIFICATION_TYPE_BY_VALUE.get(value)) ??
  null;

const readRole = (value: string | undefined): CollaboratorRole | undefined =>
  value === undefined ? undefined : COLLABORATOR_ROLE_BY_VALUE.get(value);

// The transport stringifies every value: `3`, `true` and `["Milk"]` arrive as
// `"3"`, `"true"` and `'["Milk"]'`.
const readCount = (value: string | undefined): number | undefined => {
  const count = value ? Number(value) : NaN;
  return Number.isFinite(count) ? count : undefined;
};

const readFlag = (value: string | undefined): boolean | undefined =>
  value === undefined ? undefined : value === 'true';

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readNames = (value: string | undefined): string[] => {
  const names = value ? parseJson(value) : null;
  return Array.isArray(names)
    ? names.filter((name): name is string => typeof name === 'string')
    : [];
};

/**
 * A push's display parameters as the typed data the copy builder reads.
 * Contract: sous-chef-api docs/guides/push-notifications.md § Display
 * parameters. Null for a type with no typed payload.
 */
const readCopyData = (
  type: NotificationType,
  data: Record<string, string | undefined>,
): NotificationCopyData | null => {
  switch (type) {
    case NotificationType.HomeInvitation:
      return {
        __typename: 'HomeInvitationNotificationData',
        homeName: data.homeName,
        inviterName: data.inviterName,
      };
    case NotificationType.CollaborationInvite:
      return {
        __typename: 'CollaborationInviteNotificationData',
        listName: data.listName,
        inviterName: data.inviterName,
      };
    case NotificationType.CollaborationAccepted:
      return {
        __typename: 'CollaborationAcceptedNotificationData',
        listName: data.listName,
        accepterName: data.accepterName,
      };
    case NotificationType.CollaborationDeclined:
      return {
        __typename: 'CollaborationDeclinedNotificationData',
        listName: data.listName,
        declinerName: data.declinerName,
      };
    case NotificationType.CollaboratorRemoved:
      return {
        __typename: 'CollaboratorRemovedNotificationData',
        listNameIfKnown: data.listName,
        removerName: data.removerName,
      };
    case NotificationType.CollaboratorRoleChanged:
      return {
        __typename: 'CollaboratorRoleChangedNotificationData',
        listNameIfKnown: data.listName,
        changerName: data.changerName,
        previousRole: readRole(data.previousRole),
        newRole: readRole(data.newRole),
      };
    case NotificationType.CollaboratorPermissionsUpdated:
      return {
        __typename: 'CollaboratorPermissionsUpdatedNotificationData',
        listNameIfKnown: data.listName,
        changerName: data.changerName,
      };
    case NotificationType.ListUpdated:
      return {
        __typename: 'ListUpdatedNotificationData',
        listName: data.listName,
        eventType: data.eventType,
      };
    case NotificationType.ListReminder:
      return {
        __typename: 'ListReminderNotificationData',
        listName: data.listName,
        itemCount: readCount(data.itemCount),
      };
    case NotificationType.SharedListChanged:
      return {
        __typename: 'SharedListChangedNotificationData',
        listName: data.listName,
        actorNames: readNames(data.actorNames),
      };
    case NotificationType.LowStock:
      return {
        __typename: 'LowStockNotificationData',
        itemName: data.itemName,
        currentQuantity: readCount(data.currentQuantity),
      };
    case NotificationType.ExpiryReminder:
      // One item names it; the weekly digest names several.
      return data.itemName === undefined
        ? {
            __typename: 'ExpiryDigestNotificationData',
            itemCount: readCount(data.itemCount),
            items: readNames(data.itemNames).map(name => ({
              __typename: 'NotificationPantryItem',
              name,
            })),
          }
        : {
            __typename: 'ExpiryReminderNotificationData',
            itemName: data.itemName,
            daysUntilExpiry: readCount(data.daysUntilExpiry),
            isMultiBatch: readFlag(data.isMultiBatch),
          };
    case NotificationType.NewItemAdded:
    case NotificationType.ItemUpdated:
    case NotificationType.ItemDeleted:
      return {
        __typename: 'PantryChangeNotificationData',
        pantryName: data.pantryName,
        actorNames: readNames(data.actorNames),
        itemCount: readCount(data.itemCount),
        items: readNames(data.itemNames).map(name => ({
          __typename: 'NotificationPantryItem',
          name,
        })),
      };
    case NotificationType.RunningLow:
      return {
        __typename: 'RunningLowNotificationData',
        itemCount: readCount(data.itemCount),
        items: readNames(data.itemNames).map(name => ({
          __typename: 'NotificationCatalogItem',
          name,
        })),
      };
    case NotificationType.MealPlanReminder:
      return {
        __typename: 'MealPlanReminderNotificationData',
        mealCount: readCount(data.mealCount),
        meals: readNames(data.mealNames).map(name => ({
          __typename: 'NotificationPlannedMeal',
          name,
        })),
      };
    case NotificationType.CookingReminder:
      return {
        __typename: 'CookingReminderNotificationData',
        recipeName: data.recipeName,
        mealTime: data.mealTime,
      };
    case NotificationType.RecipeRecommendations:
      return {
        __typename: 'RecipeRecommendationsNotificationData',
        recipeCount: readCount(data.recipeCount),
        recipes: readNames(data.recipeNames).map(name => ({
          __typename: 'RecommendedRecipe',
          name,
        })),
      };
    case NotificationType.WeeklyDigest:
      return {
        __typename: 'PantryWeeklyDigestNotificationData',
        itemsAdded: readCount(data.itemsAdded),
        itemsUsed: readCount(data.itemsUsed),
        itemsWasted: readCount(data.itemsWasted),
        itemsExpiringSoon: readCount(data.itemsExpiringSoon),
      };
    case NotificationType.MonthlyReport:
      return {
        __typename: 'MonthlyReportNotificationData',
        purchaseCount: readCount(data.purchaseCount),
        recipesCooked: readCount(data.recipesCooked),
        wastedItemCount: readCount(data.wastedItemCount),
      };
    case NotificationType.HomeJoined:
    case NotificationType.MembershipInvite:
    case NotificationType.RecipeSaved:
    case NotificationType.RecipeCooked:
    default:
      return null;
  }
};

export interface PushTrayCopy {
  title: string;
  body: string;
}

/**
 * The tray entry for a delivered push. Null when the push carries nothing to
 * show; the English `title`/`body` in its own data are the last resort, taken
 * only for a type this build cannot word — which is also what a field dropped
 * to fit the provider's size limit leaves behind.
 */
export const getPushTrayCopy = (
  data: Record<string, string>,
  t: Translate,
): PushTrayCopy | null => {
  const englishTitle = data.title ?? '';
  const englishBody = data.body ?? '';
  const fallback: PushTrayCopy | null =
    englishTitle || englishBody
      ? { title: englishTitle, body: englishBody }
      : null;

  // A summary stands for several deferred rows and carries no row's type or
  // display parameters, so it is worded from its count alone.
  const coalescedCount = Number(data.coalescedCount);
  if (Number.isFinite(coalescedCount) && coalescedCount > 0) {
    return {
      title: t('pushNotification.title'),
      body: t('pushNotification.coalesced', { count: coalescedCount }),
    };
  }

  const type = readType(data.type);
  if (!type) return fallback;

  const copy = getNotificationCopy(
    {
      type,
      data: readCopyData(type, data),
      // An admin wrote these words, so they are already what the reader should
      // see — in whatever language the author chose.
      isAuthoredContent: data.isAuthoredContent === 'true',
      title: englishTitle || null,
      message: englishBody || null,
    },
    t,
    todayKey(),
  );
  return { title: copy.title, body: copy.message };
};
