/**
 * useAllPendingInvites Hook
 *
 * Unified hook that fetches and displays BOTH home and shopping list invitations on app startup.
 * This ensures users don't miss invitations even if they didn't receive the real-time notification.
 *
 * Both invitation types are added to the notification store as actionable notifications
 * that open the InvitationAcceptanceModal when tapped.
 */

import { useEffect, useRef } from 'react';
import {
  useMyShoppingListInvitesQuery,
  useGetMyPendingInvitesQuery,
  NotificationType,
} from '#generated';
import { useStore } from '#store';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';

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
  const addMultipleNotifications = useStore(
    state => state.addMultipleNotifications,
  );

  // Track if we've already processed invites to prevent duplicate additions
  const processedRef = useRef(false);

  // Query pending shopping list invites
  const { data: shoppingListData, error: shoppingListError } =
    useMyShoppingListInvitesQuery({
      skip: !userId,
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all', // Return partial data on errors
    });

  // Query pending home invites
  const { data: homeData, error: homeError } = useGetMyPendingInvitesQuery({
    skip: !userId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all', // Return partial data on errors
  });

  // Log partial errors in development
  useEffect(() => {
    if (__DEV__) {
      if (shoppingListError) {
        console.warn(
          '⚠️ Partial error loading shopping list invites:',
          shoppingListError,
        );
      }
      if (homeError) {
        console.warn('⚠️ Partial error loading home invites:', homeError);
      }
    }
  }, [shoppingListError, homeError]);

  // Process and add all pending invites to notification store
  useEffect(() => {
    // Skip if already processed or no data
    if (processedRef.current || (!shoppingListData && !homeData)) {
      return;
    }
    const allInviteNotifications = [];

    // Process Shopping List Invites
    if (
      shoppingListData?.myShoppingListInvites &&
      shoppingListData.myShoppingListInvites.length > 0
    ) {
      const shoppingListInvites = shoppingListData.myShoppingListInvites
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
            listId: invite.shoppingListId,
            listName: invite.shoppingList?.name,
            inviterName:
              invite.invitedBy?.profile?.displayName || invite.invitedBy?.email,
            inviterEmail: invite.invitedBy?.email,
            role: invite.role,
          },
          sentAt: invite.invitedAt,
          isRead: false,
          requiresAction: true,
          actionType: 'ACCEPT_SHOPPING_LIST_INVITE' as const,
          actionData: {
            inviteId: invite.id,
            listId: invite.shoppingListId,
          },
          expiresAt: invite.expiresAt,
          source: 'server' as const,
        }));

      allInviteNotifications.push(...shoppingListInvites);
    }

    // Process Home Invites
    if (homeData?.myPendingInvites && homeData.myPendingInvites.length > 0) {
      const homeInvites = homeData.myPendingInvites
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
            role: invite.role,
          },
          sentAt: invite.sentAt,
          isRead: false,
          requiresAction: true,
          actionType: 'ACCEPT_HOME_INVITE' as const,
          actionData: {
            inviteId: invite.id,
            homeId: invite.homeId,
          },
          expiresAt: invite.expiresAt,
          source: 'server' as const,
        }));

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
            ).length,
          },
        );
      }
    }
  }, [shoppingListData, homeData, addMultipleNotifications]);
}
