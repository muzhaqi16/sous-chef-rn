/**
 * ONE `userEvents(userId)` stream routed by `subtype`, because the server caps
 * concurrent subscriptions per user. ACCOUNT_UPDATED / PROFILE_CHANGED
 * normalize by id; lifecycle subtypes carry their context on the envelope.
 */

import { useApolloClient, useSubscription } from '@apollo/client/react';
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
import {
  UserEventsDocument,
  type UserEventsSubscription,
} from '#operations/auth/user.generated';
import { GetHomesDocument } from '#operations/home/home.generated';
import { forgetHome } from '#/domain/forgetHome';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { announceWorkSettled } from '#/services/subscriptions/settledWork';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import {
  ModerationReasonCode,
  UserSubtype,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { t } from '#/i18n';
import { toastService } from '#/services/toastService';
import { authService } from '#/services/authService';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

type UserEventPayload = UserEventsSubscription['userEvents'];

/** A leave arrives as a removal the user made themselves; it is not news. */
const removedThemselves = (payload: UserEventPayload) =>
  !!payload.actorUserId && payload.actorUserId === payload.userId;

function handleRemovedFromHome(
  payload: UserEventPayload,
  client: SubscriptionApolloClient,
) {
  const homeId = payload.parents?.homeId;
  if (!homeId) return;

  forgetHome(client.cache, homeId);

  if (!removedThemselves(payload)) {
    toastService.error(t('accountEvents.removedFromHome'));
  }
}

/** `ownAccept`: the echo of an invite this device just accepted. */
function handleAddedToHome(
  client: SubscriptionApolloClient,
  ownAccept: boolean,
) {
  void client.refetchQueries({ include: [GetHomesDocument] });
  if (!ownAccept) toastService.success(t('accountEvents.addedToHome'));
}

function handleRemovedFromShoppingList(
  payload: UserEventPayload,
  client: SubscriptionApolloClient,
) {
  const listId = payload.parents?.shoppingListId;
  if (!listId) return;

  safeEvict(client.cache, 'ShoppingList', listId);

  const store = useStore.getState();
  if (store.selectedShoppingListId === listId) {
    store.setSelectedShoppingListId(null);
  }

  if (!removedThemselves(payload)) {
    toastService.error(t('accountEvents.removedFromShoppingList'));
  }
}

function handleAddedToShoppingList(ownAccept: boolean) {
  if (!ownAccept) toastService.success(t('accountEvents.addedToShoppingList'));
}

/**
 * `reason` is a moderator's own English, so no toast shows it; `reasonCode`
 * tells the failed-login lockout, which lifts by itself, from a moderator's
 * decision, which does not.
 */
function handleBannedOrSuspended(payload: UserEventPayload) {
  const message =
    payload.reasonCode === ModerationReasonCode.FailedLoginAttempts
      ? // The count is the server's; without it the sentence omits the number
        // rather than stating a zero.
        payload.failedLoginCount == null
        ? t('accountEvents.accountLocked')
        : t('accountEvents.accountLockedAttempts', {
            count: payload.failedLoginCount,
          })
      : payload.subtype === UserSubtype.Banned
      ? t('accountEvents.accountBanned')
      : t('accountEvents.accountSuspended');
  toastService.error(message);
  void authService.logout();
}

/**
 * Multi-device profile/settings sync and lifecycle events (membership changes,
 * moderation actions, background work settling).
 */
export function useUserSubscriptions(userId?: string) {
  const client = useApolloClient();

  const userEventHandlers = subscriptionService.register<UserEventPayload>({
    document: UserEventsDocument,
    entityType: 'User',
    enableDeduplication: false,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    customOnData: (payload: UserEventPayload) => {
      switch (payload.subtype) {
        // Apollo auto-normalizes the User / UserProfile node by id; no manual
        // cache work needed (mirrors the former userUpdated / userProfileChanged
        // subscriptions, which had no handler).
        case UserSubtype.AccountUpdated:
        case UserSubtype.ProfileChanged:
          break;

        case UserSubtype.RemovedFromHome:
          handleRemovedFromHome(payload, client);
          break;

        case UserSubtype.AddedToHome:
          handleAddedToHome(client, isSelfEcho(payload, userId));
          break;

        case UserSubtype.RemovedFromShoppingList:
          handleRemovedFromShoppingList(payload, client);
          break;

        case UserSubtype.AddedToShoppingList:
          handleAddedToShoppingList(isSelfEcho(payload, userId));
          break;

        case UserSubtype.Banned:
        case UserSubtype.Suspended:
          handleBannedOrSuspended(payload);
          break;

        case UserSubtype.Warned:
          toastService.error(t('accountEvents.warningReceived'));
          break;

        case UserSubtype.Unbanned:
        case UserSubtype.Unsuspended:
          break;

        // The screen waiting on it asks once, instead of polling until it sees.
        case UserSubtype.ReceiptParseSettled:
          if (payload.parents?.receiptParseId) {
            announceWorkSettled({
              kind: 'receiptParse',
              id: payload.parents.receiptParseId,
            });
          }
          break;

        case UserSubtype.RecipeCaptureSettled:
          if (payload.parents?.recipeCaptureId) {
            announceWorkSettled({
              kind: 'recipeCapture',
              id: payload.parents.recipeCaptureId,
            });
          }
          break;
      }
    },
  });

  const userSkip = !userId;
  const userEvents = useSubscription(UserEventsDocument, {
    variables: { userId: userId ?? '' },
    skip: userSkip,
    ...userEventHandlers,
  });
  useSubscriptionTransportRecovery(UserEventsDocument, userEvents, userSkip);
}
