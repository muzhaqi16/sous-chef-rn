import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toDateKey } from '#/utils/dateUtils';

const nowKey = () => toDateKey(new Date());

/**
 * The phone's calendar date as a `LocalDate` key: the one `today` the expiry
 * badge and lists send, so they cannot disagree. It turns over at local
 * midnight, and on returning to the foreground since a backgrounded timer may
 * not have fired.
 */
export const useToday = (): string => {
  const [today, setToday] = useState(nowKey);

  useEffect(() => {
    const refresh = () => setToday(nowKey());
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
};
