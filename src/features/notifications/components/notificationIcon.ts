import { NotificationType } from '#/graphql/generated/schemaTypes';
import type { IconName } from '#components/atoms/Icon';

export const getNotificationIcon = (type: NotificationType): IconName => {
  switch (type) {
    case NotificationType.ExpiryReminder:
      return 'time';
    case NotificationType.LowStock:
      return 'cube';
    case NotificationType.RunningLow:
      return 'trending-down';
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
    case NotificationType.ListReminder:
      return 'alarm';
    case NotificationType.SharedListChanged:
      return 'people-circle';
    case NotificationType.MealPlanReminder:
      return 'calendar';
    case NotificationType.CookingReminder:
      return 'restaurant';
    case NotificationType.RecipeRecommendations:
      return 'sparkles';
    case NotificationType.WeeklyDigest:
      return 'stats-chart';
    case NotificationType.MonthlyReport:
      return 'bar-chart';
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
