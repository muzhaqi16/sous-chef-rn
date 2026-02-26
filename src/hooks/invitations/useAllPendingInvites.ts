/**
 * useAllPendingInvites Hook
 *
 * Unified hook that fetches and displays BOTH home and shopping list invitations on app startup.
 * This ensures users don't miss invitations even if they didn't receive the real-time notification.
 *
 * Both invitation types are added to the notification store as actionable notifications
 * that open the InvitationAcceptanceModal when tapped.
 *
 * PERFORMANCE OPTIMIZATION:
 * Invitation queries are deferred by 2500ms after authentication to avoid competing
 * with screen-critical queries (Pantry, StorageLocations) at startup.
 * Invitations are not time-critical - users can wait a few seconds to see them.
 */

import { useEffect, useRef } from 'react';
import {
  useMyShoppingListInvitesLazyQuery,
  useGetMyPendingInvitesLazyQuery,
  NotificationType } from '#generated';
import { useAppStore } from '#store/useAppStore';
import {
  NotificationCategory,
  NotificationPriority } from '#store/slices/notificationSlice';
import { useDeferredCallback } from '#hooks/performance/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

/**
 * Hook to fetch and display all pending invitations (home + shopping list)
 *
 * @param userId - Current user ID (skips queries if not provided)
 *
 * @example
 * ```typescript
 * // In DataProvider
 * const { user } = useAuth();
 * useAllPendingInvites(user?.id);
 * ```
 */
export function useAllPendingInvites(userId?: string) {
  const addMultipleNotifications = useAppStore(
    state => state.addMultipleNotifications,
  );

  // Track if we've already processed invites to prevent duplicate additions
  const processedRef = useRef(false);
  // Track if queries have been fetched this session
  const hasFetchedRef = useRef(false);

  // PERFORMANCE: Use lazy queries to defer execution until after screen-critical queries complete
  const [fetchShoppingListInvites, { data: shoppingListData, error: shoppingListError }] =
    useMyShoppingListInvitesLazyQuery({
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all', // Return partial data on errors
    });

  const [fetchHomeInvites, { data: homeData, error: homeError }] =
    useGetMyPendingInvitesLazyQuery({
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all', // Return partial data on errors
    });

  // Fetch both invitation types in parallel
  const fetchInvitations = () => {
    if (hasFetchedRef.current || !userId) return;
    hasFetchedRef.current = true;

    // Fire both queries in parallel (non-blocking)
    fetchShoppingListInvites();
    fetchHomeInvites();

    if (__DEV__) {
      console.log('📬 [useAllPendingInvites] Deferred invitation queries started');
    }
  };

  // PERFORMANCE: Defer invitation queries by 10000ms to avoid competing with
  // screen-critical queries (GetHomes, GetPantry) at startup.
  // Invitations are not time-critical - users can wait several seconds to see them.
  useDeferredCallback(fetchInvitations, !!userId, 10000);

  // Reset fetch flag on logout so queries run again on next login
  useEffect(() => {
    if (!userId) {
      hasFetchedRef.current = false;
      processedRef.current = false;
    }
  }, [userId]);

  useApolloErrorLogger('MyShoppingListInvites', shoppingListError);
  useApolloErrorLogger('GetMyPendingInvites', homeError);

  // Process and add all pending invites to notification store
  useEffect(() => {
    // Skip if already processed or no data
    if (processedRef.current || (!shoppingListData && !homeData)) {
      return;
    }
    const allInviteNotifications = [];

    // Process Shopping List Invites
    if (
      shoppingListData?.me?.pendingCollaborationInvites &&
      shoppingListData.me.pendingCollaborationInvites.length > 0
    ) {
      const shoppingListInvites = shoppingListData.me.pendingCollaborationInvites
        .filter(invite => invite?.status === 'PENDING')
        .map(invite => ({
          id: `shopping-list-invite-${invite.id}`,
          type: NotificationType.CollaborationInvite,
          category: NotificationCategory.COLLABORATION,
          priority: NotificationPriority.HIGH,
          title: 'Shopping List Invitation',
          message: `${
            invite.invitedBy?.profile?.displayName ||
            invite.invitedBy?.email ||
            'Someone'
          } invited you to "${invite.shoppingList?.name || 'a shopping list'}"`,
          payload: {
            inviteId: invite.id,
            token: invite.token,
            listId: invite.shoppingListId,
            listName: invite.shoppingList?.name,
            inviterName:
              invite.invitedBy?.profile?.displayName || invite.invitedBy?.email,
            inviterEmail: invite.invitedBy?.email,
            role: invite.role },
          sentAt: invite.invitedAt,
          isRead: false,
          requiresAction: true,
          actionType: 'ACCEPT_SHOPPING_LIST_INVITE' as const,
          actionData: {
            inviteId: invite.id,
            token: invite.token,
            listId: invite.shoppingListId },
          expiresAt: invite.expiresAt,
          source: 'server' as const }));

      allInviteNotifications.push(...shoppingListInvites);
    }

    // Process Home Invites
    if (homeData?.me?.pendingHomeInvites && homeData.me.pendingHomeInvites.length > 0) {
      const homeInvites = homeData.me.pendingHomeInvites
        .filter(invite => invite?.status === 'PENDING')
        .map(invite => ({
          id: `home-invite-${invite.id}`,
          type: NotificationType.HomeInvitation,
          category: NotificationCategory.MEMBERSHIP,
          priority: NotificationPriority.HIGH,
          title: 'Home Invitation',
          message: `${
            invite.inviter?.profile?.displayName ||
            invite.inviter?.email ||
            'Someone'
          } invited you to join "${invite.home?.name || 'a home'}"`,
          payload: {
            inviteId: invite.id,
            token: invite.token,
            homeId: invite.homeId,
            homeName: invite.home?.name,
            inviterName:
              invite.inviter?.profile?.displayName || invite.inviter?.email,
            inviterEmail: invite.inviter?.email,
            role: invite.role },
          sentAt: invite.sentAt,
          isRead: false,
          requiresAction: true,
          actionType: 'ACCEPT_HOME_INVITE',
          actionData: {
            inviteId: invite.id,
            homeId: invite.homeId },
          expiresAt: invite.expiresAt,
          source: 'server' as const }));

      allInviteNotifications.push(...homeInvites);
    }

    // Add all pending invite notifications to store if any found
    if (allInviteNotifications.length > 0) {
      addMultipleNotifications(allInviteNotifications);
      processedRef.current = true; // Mark as processed to prevent re-runs

      if (__DEV__) {
        console.log(
          '📬 [useAllPendingInvites] Added pending invitations:',
          allInviteNotifications.length,
          {
            shoppingLists: allInviteNotifications.filter(
              n => n.type === NotificationType.CollaborationInvite,
            ).length,
            homes: allInviteNotifications.filter(
              n => n.type === NotificationType.HomeInvitation,
            ).length },
        );
      }
    }
  }, [shoppingListData, homeData, addMultipleNotifications]);
}
