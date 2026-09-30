/**
 * Loads unread notifications after startup. Foreground and reconnect re-queries
 * are the client's resync (`src/apollo/refetchEvents.ts`), which re-requests
 * this watcher like any other. The query is the whole hook — Apollo normalizes
 * the rows and the badge aggregates, so nothing here may keep a second copy.
 */

import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { useDeferredCallback } from '#features/notifications/hooks/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export function useNotificationsOnLaunch(userId?: string) {
  const [startedFor, setStartedFor] = useState<string | undefined>();

  // A sign-out re-arms the deferral for whoever signs in next.
  if (!userId && startedFor !== undefined) {
    setStartedFor(undefined);
  }

  // PERFORMANCE: Defer 10 s to avoid competing with screen-critical queries at startup
  useDeferredCallback(() => setStartedFor(userId), !!userId, 10000);

  const { error } = useQuery(
    GetUnreadNotificationsDocument,
    userId && startedFor === userId ? {} : skipToken,
  );

  useApolloErrorLogger(GetUnreadNotificationsDocument, error);
}
