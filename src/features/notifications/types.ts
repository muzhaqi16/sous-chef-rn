import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';

/** Data passed from the expirationNotificationChanged subscription to enrich a generic notification. */
export interface ExpirationLinkData {
  /** Absent until the enrichment event resolves the backing row. */
  expirationNotificationId?: string;
  expirationAction?: string | null;
  /** YYYY-MM-DD; the day count is taken when the sheet renders. */
  expiresOn?: string | null;
  pantryItemName?: string | null;
  pantryItemImageUrl?: string | null;
}

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory);

/** Every field optional, at every depth, except each member's `__typename`. */
type Shown<Value> = Value extends readonly (infer Item)[]
  ? Shown<Item>[]
  : Value extends { __typename: string }
  ? Pick<Value, '__typename'> & {
      [Field in Exclude<keyof Value, '__typename'>]?: Shown<Value[Field]>;
    }
  : Value;

/**
 * What the copy builder reads: `Notification.data` as the feed selects it. A
 * push fills the same shape from its display parameters, which carry no ids
 * and can be dropped to fit the provider's size limit, so any field may be
 * missing.
 */
export type NotificationCopyData = Shown<
  NonNullable<UseNotificationsOnLaunch_NotificationFragment['data']>
>;

/** A pending invite as the acceptance modal and its action handler see it. */
export interface InvitationData {
  type: 'HOME_INVITE' | 'SHOPPING_LIST_INVITE';
  id: string;
  inviterName?: string;
  /** Home name or shopping list name. */
  entityName: string;
  /** The invite the notification names. */
  inviteId?: string;
  token?: string;
  /** What the dialog's copy reads. */
  data: NotificationCopyData | null;
  /** Set by the accept flow so the caller can select the home it just joined. */
  acceptedHomeId?: string;
}
