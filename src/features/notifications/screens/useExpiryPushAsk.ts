import { useEffect, useEffectEvent, useRef } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { storeApi } from '#store';
import { useAppStore, useUser } from '#store/useAppStore';
import { useNotificationSettings } from '#features/notifications/hooks/useNotificationSettings';
import { useTurnOnPush } from './useTurnOnPush';

/**
 * Asks to turn notifications on once the pantry first holds dated food, on
 * the screen where the dates show: once per account on this device, never
 * while push is already on, never during onboarding. The ask names the food
 * that expires first; the system prompt shows only after a yes.
 */
export function useExpiryPushAsk({
  datedItemName,
  isFocused,
}: {
  /** The pantry's dated stock that expires first; null when nothing is dated. */
  datedItemName: string | null;
  isFocused: boolean;
}) {
  const user = useUser();
  const userId = user?.id;
  const answered = useAppStore(state =>
    userId ? state.pushAskAnswered[userId] : undefined,
  );
  const { settings, hasPreferences, updateMultipleSettings } =
    useNotificationSettings();
  const { hasPermission, turnOnPush } = useTurnOnPush(updateMultipleSettings);

  // Push on in the app and allowed by the device: there is nothing to ask.
  // Unknown until both have been read.
  const pushOn = hasPermission === true && settings.pushEnabled;
  const known = hasPreferences && hasPermission !== null;
  const shouldAsk =
    isFocused &&
    datedItemName !== null &&
    !!user?.onBoarded &&
    !!userId &&
    !answered &&
    known &&
    !pushOn;

  // One dialog per visit, however often this re-renders while it shows.
  const askedRef = useRef(false);
  const ask = useEffectEvent((item: string, account: string) => {
    if (askedRef.current) return;
    askedRef.current = true;
    const answer = () => storeApi.getState().answerPushAsk(account);
    alertService.alert(
      t('notifications.expiryAsk.title'),
      t('notifications.expiryAsk.message', { item }),
      [
        { text: t('labels.notNow'), style: 'cancel', onPress: answer },
        {
          text: t('notifications.expiryAsk.turnOn'),
          onPress: () => {
            answer();
            void turnOnPush({ expirationNotifications: true });
          },
        },
      ],
    );
  });
  useEffect(() => {
    if (shouldAsk && datedItemName && userId) ask(datedItemName, userId);
  }, [shouldAsk, datedItemName, userId]);
}
