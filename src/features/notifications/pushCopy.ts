/**
 * Tray copy for a delivered push, in the reader's language.
 *
 * The public entry the push service calls: a push arrives as a flat map of
 * strings, and `getNotificationCopy` reads a typed payload, so the coercion
 * lives here rather than in either. The wording itself stays in the one copy
 * builder the in-app feed uses — a second table would diverge the first time
 * either was translated.
 */

import { NotificationType } from '#/graphql/generated/schemaTypes';
import type { NotificationPayload } from '#features/notifications/types';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';
import type { Translate } from '#/i18n/types';

/** Keys the transport carries for routing and correlation, never for copy. */
const NON_PAYLOAD_KEYS = new Set([
  'type',
  'title',
  'body',
  'notificationId',
  'category',
  'sourceId',
  'sourceType',
  'isAuthoredContent',
  'coalescedCount',
  'coalescedTypes',
]);

/**
 * A wire string is not an enum member, so a type this build predates has to be
 * recognized as unknown rather than asserted into the enum. Keyed by the wire
 * spelling, which is the enum's own value.
 */
const NOTIFICATION_TYPE_BY_VALUE = new Map<string, NotificationType>(
  Object.values(NotificationType).map(type => [type, type]),
);

const readType = (value: string | undefined): NotificationType | null =>
  (value === undefined ? undefined : NOTIFICATION_TYPE_BY_VALUE.get(value)) ??
  null;

/** A list or object the transport stringified; the raw text if it is neither. */
const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/**
 * FCM stringifies every value: `3`, `true` and `["Milk"]` arrive as `"3"`,
 * `"true"` and `'["Milk"]'`. Each is restored to the shape the copy builder
 * reads; anything else stays the string it arrived as.
 */
const readValue = (raw: string): unknown => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && Number.isFinite(Number(raw))) return Number(raw);
  if (raw.startsWith('[') || raw.startsWith('{')) return parseJson(raw);
  return raw;
};

const readPayload = (data: Record<string, string>): NotificationPayload => {
  const payload: NotificationPayload = {};
  for (const [key, raw] of Object.entries(data)) {
    if (!NON_PAYLOAD_KEYS.has(key)) payload[key] = readValue(raw);
  }
  return payload;
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
      payload: readPayload(data),
      // An admin wrote these words, so they are already what the reader should
      // see — in whatever language the author chose.
      isAuthoredContent: data.isAuthoredContent === 'true',
      title: englishTitle || null,
      message: englishBody || null,
    },
    t,
  );
  return { title: copy.title, body: copy.message };
};
