import type { TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import type { NotificationSettings } from '#features/notifications/hooks/useNotificationSettings';
import { EXPIRATION_THRESHOLD_DAYS } from '#features/notifications/utils/expirationLadder';
import { ExpirationFrequency } from '#/graphql/generated/schemaTypes';

/** The notification settings screen's rows, grouped by section. */
export interface SettingDef {
  key: keyof NotificationSettings;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

export const CHANNEL_SETTINGS: SettingDef[] = [
  {
    key: 'pushEnabled',
    titleKey: 'notifications.pushNotifications',
    descriptionKey: 'notifications.pushNotificationsDesc',
  },
  {
    key: 'emailEnabled',
    titleKey: 'notifications.emailNotifications',
    descriptionKey: 'notifications.emailNotificationsDesc',
  },
  {
    key: 'smsEnabled',
    titleKey: 'notifications.smsNotifications',
    descriptionKey: 'notifications.smsNotificationsDesc',
  },
];

export const PANTRY_SETTINGS: SettingDef[] = [
  {
    key: 'lowStockAlerts',
    titleKey: 'notifications.lowStockAlerts',
    descriptionKey: 'notifications.lowStockAlertsDesc',
  },
  {
    key: 'pantryChanges',
    titleKey: 'notifications.pantryUpdates',
    descriptionKey: 'notifications.pantryUpdatesDesc',
  },
];

export const SHOPPING_SETTINGS: SettingDef[] = [
  {
    key: 'shoppingListUpdates',
    titleKey: 'notifications.listUpdates',
    descriptionKey: 'notifications.listUpdatesDesc',
  },
  {
    key: 'sharedListUpdates',
    titleKey: 'notifications.sharedListUpdates',
    descriptionKey: 'notifications.sharedListUpdatesDesc',
  },
];

export const SOCIAL_SETTINGS: SettingDef[] = [
  {
    key: 'collaborationInvites',
    titleKey: 'notifications.collaborationInvites',
    descriptionKey: 'notifications.collaborationInvitesDesc',
  },
  {
    key: 'homeInvites',
    titleKey: 'notifications.homeInvitations',
    descriptionKey: 'notifications.homeInvitationsDesc',
  },
];

export const RECIPE_SETTINGS: SettingDef[] = [
  {
    key: 'recipeRecommendations',
    titleKey: 'notifications.recipeRecommendations',
    descriptionKey: 'notifications.recipeRecommendationsDesc',
  },
  {
    key: 'mealPlanReminders',
    titleKey: 'notifications.mealPlanReminders',
    descriptionKey: 'notifications.mealPlanRemindersDesc',
  },
  {
    key: 'cookingReminders',
    titleKey: 'notifications.cookingReminders',
    descriptionKey: 'notifications.cookingRemindersDesc',
  },
];

export const DIGEST_SETTINGS: SettingDef[] = [
  {
    key: 'weeklyDigest',
    titleKey: 'labels.weeklyDigest',
    descriptionKey: 'notifications.weeklyDigestDesc',
  },
  {
    key: 'monthlyReport',
    titleKey: 'notifications.monthlyReport',
    descriptionKey: 'notifications.monthlyReportDesc',
  },
];

export const QUIET_HOURS_SETTINGS: SettingDef[] = [
  {
    key: 'quietHoursEnabled',
    titleKey: 'notifications.enableQuietHours',
    descriptionKey: 'notifications.enableQuietHoursDesc',
  },
];

export const getFrequencyOptions = (t: Translate) => [
  {
    label: t('notifications.frequencyRealTime'),
    value: ExpirationFrequency.RealTime,
  },
  {
    label: t('notifications.frequencyDailyMorning'),
    value: ExpirationFrequency.DailyMorning,
  },
  {
    label: t('notifications.frequencyDailyEvening'),
    value: ExpirationFrequency.DailyEvening,
  },
  {
    label: t('labels.weeklyDigest'),
    value: ExpirationFrequency.WeeklyDigest,
  },
  {
    label: t('labels.never'),
    value: ExpirationFrequency.Never,
  },
];

const thresholdLabel = (t: Translate, days: number): string => {
  if (days === 0) return t('notifications.thresholdSameDay');
  if (days === 1) return t('notifications.thresholdNDaysBefore', { n: 1 });
  return t('notifications.thresholdNDaysBeforePlural', { n: days });
};

// Derived from the ladder, so an offered value always maps to a rung the API
// can actually fire.
export const getThresholdOptions = (t: Translate) =>
  EXPIRATION_THRESHOLD_DAYS.map(days => ({
    label: thresholdLabel(t, days),
    value: String(days),
  }));
