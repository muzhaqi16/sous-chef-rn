# API request: structured data for every string the app shows

**From:** sous-chef-rn · **To:** sous-chef-api · **Priority:** P1–P3 per item

## Summary

The API is English-only and stays that way. This request does not ask for translations, localization keys, or an `Accept-Language` header.

The app ships in en/es/it/sq and writes every user-facing word itself. It builds that copy from **codes, enums and parameters**. Wherever the API sends only an English sentence, the app has nothing to translate from, so it shows a generic fallback.

**What we ask:** next to each English string listed below, add the machine-readable data the sentence was built from.

**Constraints:**

- Keep the English strings exactly as they are, for logs, admin tooling and old clients.
- Every change is additive.

**How the app enforces its side:** `sous-chef/no-rendered-server-message` fails lint if a server `message`, or any field in the table in `docs/rules/no-rendered-server-message.md`, reaches the screen. So a new English-only field ships as a generic sentence until it gets structured data.

Paths below are relative to `sous-chef-api/packages/`.

---

## 1. Pushes the OS draws itself carry English (P1)

**Now**

- Visible pushes put English in APNs `aps.alert.title/body` and FCM `notification.title/body` (`core/src/services/push/pushTypes.ts`). iOS, and Android when the app is backgrounded, draw that text without running app code, so users of every locale see English.
- The custom data (`PushDataPayload`) carries only `notificationId`, `type`, `category`, `sourceId` and `sourceType`, not the names the sentence was built from.
- The coalesced push says `` `${total} updates while you were away` `` and joins the pending English messages (`core/src/services/jobs/processors/pushProcessor.ts`).

**Request**

1. **Payload in the data:** copy the notification's `payload` (the same keys `Notification.payload` exposes, e.g. `inviterName`, `homeName`, `listName`, `itemName`, `daysUntilExpiry`, `itemCount`, `itemNames`) into `PushDataPayload`. On FCM these arrive as string values.
2. **APNs:** set `aps["mutable-content"] = 1` on alert pushes, so an iOS Notification Service Extension can rewrite the title and body from that data before display. Keep the English `alert` as the fallback the OS shows if the extension doesn't run.
3. **FCM:** send alert pushes as **data-only** messages: no `notification` block, `android.priority: "high"`, plus `title`/`body` inside `data`. The app then draws the tray notification in the user's language, and falls back to the English `data.title`/`data.body` for a type it doesn't know.
4. **Coalesced push:** add `coalescedCount` (number) and `coalescedTypes` (the `NotificationType` names of the pending rows, capped like `COALESCED_TITLE_CAP`) to the data.

**Acceptance**

- An FCM push for every `NotificationType` has no `notification` block, and its `data` includes `type` plus every payload key the English sentence uses.
- An APNs alert push has `mutable-content: 1` and the same custom keys.

**App work on our side:** Android already renders data-only pushes (`src/services/push/nativePushMessaging.ts`). The iOS Notification Service Extension is new app work, and it depends on item 2.

---

## 2. Role-change notification: roles as enum names (P2)

**Now:** `buildCollaboratorRoleChangedNotification` (`core/src/services/notification/NotificationFactory.ts`) types `previousRole` and `newRole` as `string` and builds the message from them. The app can't safely map an untyped string, so its sentence leaves the role out.

**Request:** type both as `CollaboratorRole` (`schema/src/typedefs/enums/collaboration.ts`) in the factory params, and guarantee the payload values are exactly the enum member names (`OWNER`, `ADMIN`, …).

**Acceptance:** a unit test shows the payload's `previousRole`/`newRole` are always `CollaboratorRole` members.

---

## 3. Moderation reasons: a reason code (P2)

**Now**

- `UserEvent.reason` and `MyModerationStatus.banReason` / `suspensionReason` / `restrictionReason` hold either a moderator's free text or the automatic `` `Auto-locked after ${failureCount} failed login attempts` `` (`core/src/services/user/UserModerationService.ts`, `core/src/subscriptions/publishers/UserPublisher.ts`).
- There is no code telling the two apart, so the app can't explain an automatic lock and never shows a reason.

**Request:** add `enum ModerationReasonCode { FAILED_LOGIN_ATTEMPTS, MODERATOR, POLICY_VIOLATION, OTHER }` (extend as needed), plus:

- `UserEvent.reasonCode: ModerationReasonCode` and `UserEvent.failedLoginCount: Int` (set for `FAILED_LOGIN_ATTEMPTS`);
- `MyModerationStatus.banReasonCode`, `suspensionReasonCode` and `restrictionReasonCode`.

Keep the text fields as they are. A moderator's own words are admin content; the app decides separately whether to show them verbatim.

**Acceptance:** an automatic lock publishes `reasonCode: FAILED_LOGIN_ATTEMPTS` with `failedLoginCount`, and a moderator action publishes `MODERATOR`.

---

## 4. Per-item failures: an `ErrorCode` beside the English `reason`/`error` (P2)

**Now:** these carry only a sanitized English message, so the app shows one generic "couldn't add/move/deduct this item" line and can't say why.

| Field                                  | Written by                                                                                                                 | Has a code?                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `BatchAddShoppingListItemResult.error` | `core/src/services/shopping/ShoppingListItemBatchService.ts` (`getErrorMessage(error) \|\| "Failed to add item"`)          | no                                        |
| `BatchUpsertItemResult.error`          | `core/src/services/externalSource/ExternalSourceService.ts`                                                                | no                                        |
| `ConsumptionFailure.reason`            | `core/src/services/pantry/PantryDeductionService.ts` via `core/src/utils/errors/payloadFailureReason.ts`                   | no                                        |
| `SkippedRecipeIngredient.reason`       | same                                                                                                                       | no                                        |
| `SkippedLowStockItem.reason`           | `core/src/services/pantry/PantryShoppingIntegrationService.ts` (`"Item already in shopping list"`, caught `error.message`) | no                                        |
| `FailedMoveInfo.reason`                | `core/src/services/shopping/ShoppingToPantryService.ts`                                                                    | **yes** (`code`) — the model for the rest |

**Request:** add `code: ErrorCode!` (the existing enum) to each type above without one, using the same code the thrown error carries.

- Give failures without a thrown error a specific member: `ITEM_ALREADY_IN_LIST` for the low-stock skip, `UNIT_CONVERSION_UNAVAILABLE` for a skipped recipe ingredient, and `INSUFFICIENT_QUANTITY` for deductions.
- Where a failure has parameters, expose them as fields: `ConsumptionFailure` already has `requestedQuantity`/`availableQuantity`, and `SkippedRecipeIngredient` has `fromUnitId`/`toUnitId`.

**Acceptance:** every per-item failure type has a non-null `code`, and no path fills `reason`/`error` without also setting `code`.

---

## 5. `PantryItemUsage.adjustmentReason`: a kind for server-written entries (P3)

**Now:** the field holds the reason a person typed, except two server sentinels: `"stack merge reconciliation"` (`core/src/services/pantry/PantryStackMergeService.ts`) and `"PANTRY_STACK_PURGED"` (`core/src/services/pantry/PantryItemCRUDService.ts`). The app string-matches both (`src/features/pantry/components/UsageHistoryRow.tsx`), and a changed sentinel would silently show raw text.

**Request:** add `adjustmentKind: AdjustmentKind` with `enum AdjustmentKind { USER, STACK_MERGE, STACK_PURGED }`, and set it on every write. Keep `adjustmentReason` for user-typed text.

**Acceptance:** the two sentinel writes set `STACK_MERGE` / `STACK_PURGED`, and user adjustments set `USER`.

---

## 6. `ItemValidationWarning`: a code beside `suggestion` (P3)

**Now:** `suggestion` is English (`"Add a UPC for barcode scanning support"`, … in `schema/src/resolvers/item/item.queries.ts`). The only structured field is `field`, which doesn't distinguish two warnings on the same field.

**Request:** add `code: ItemValidationWarningCode!`, an enum with one member per distinct suggestion the resolver emits (e.g. `MISSING_UPC`).

**Acceptance:** every warning the resolver returns carries a `code`, and each distinct English suggestion maps to exactly one code.

---

## 7. Activity and invite logs: typed parameters instead of `metadata` JSON (P3)

**Now:** `ShoppingListActivity.description` (`core/src/services/shopping/ShoppingListActivityService.ts`, e.g. `` `${actorName} cleared ${count} item${count === 1 ? "" : "s"} from the list` ``) and `InviteLog.description` (`core/src/repositories/invite/InviteLogRepository.ts`) are English. Some parameters, such as the cleared count, exist only inside untyped `metadata` or not at all.

**Request:** expose the parameters each `action` uses as typed, nullable fields:

- on `ShoppingListActivity`: `itemCount: Int` and `listName: String` (plus `actor`/`user`, `itemName`, `oldValue`/`newValue`, which already exist);
- on `InviteLog`: `oldStatus`/`newStatus` as enums, and the actor.

Document per `action` which fields are set.

**Acceptance:** for every `ListActivityType` and invite-log action, the fields its English `description` interpolates are available as typed fields.

---

## 8. `DeletionBlocker`: counts beside `message` (P3)

**Now:** the app builds blocker copy from `type` + `resourceName`. The message's count ("which has 1 active collaborator(s)") exists only inside the English `message`.

**Request:** add `memberCount: Int` for `HOME_OWNERSHIP` blockers and `collaboratorCount: Int` for `SHOPPING_LIST` blockers.

**Acceptance:** each blocker type carries the count its English message mentions.

---

## 9. Admin bulk notifications: mark them as authored content (P3, question)

**Now:** `sendBulkNotifications` stores an admin's free text as `title`/`message` with no payload names, so the app shows a generic sentence for the type.

**Question:** should admin-written announcements be treated as authored content (shown as written, like a list name) rather than system copy? If yes, add `isAuthoredContent: Boolean!` to `Notification`, `true` only for admin-authored rows, so the app can show those rows verbatim and keep translating everything else.

---

## Not requested (already structured, or content)

- **`LedgerPeriodData.periodLabel`** is a UTC bucket key (`2026-09-14` / `2026-09`); the app formats it locally. A schema doc comment saying "a key, not a label" would help.
- **`Notification` for invites, lists, low stock and expiry** already has the payload names the app needs; only the push transport (item 1) lacks them.
- **Codes and identifiers** (`LoginEvent.failureReason`, `ItemPhoto.perspective`, `Recipe.source`), **user content** (names, notes, descriptions, review comments) and **catalog reference data** (item and category descriptions, unit display names) stay as they are.
- **`MEMBERSHIP_INVITE`, `HOME_JOINED` and the item/recipe notification types** are never created by the API today. If they're added later, they need payload names from the start.

---

## API response

**From:** sous-chef-api · **Status:** implemented, not yet released

Everything below is additive except the two items marked **breaking**. Every English string stays as it was. Where the result differs from what was asked, the difference and the reason are stated.

**One action for you:** tell us the first Android build that draws a data-only push. See item 1.

### 1. Push payloads: done, with an allowlist instead of the whole payload

- **Fields copied.** Push data carries only the payload keys the English text is built from, chosen per type. It never carries ids, invite tokens or email addresses: a push passes through Apple and Google and can show on a locked screen. Copying the whole `payload` would have sent invite tokens with it.
  - `HOME_INVITATION`: `homeName`, `inviterName`, `role`
  - `COLLABORATION_INVITE`: `listName`, `inviterName`, `role`
  - `COLLABORATOR_REMOVED`: `listName`, `removerName`
  - `COLLABORATOR_ROLE_CHANGED`: `listName`, `changerName`, `previousRole`, `newRole`
  - `COLLABORATOR_PERMISSIONS_UPDATED`: `listName`, `changerName`, `changedFields`
  - `COLLABORATION_ACCEPTED`: `listName`, `accepterName`, `role`
  - `COLLABORATION_DECLINED`: `listName`, `declinerName`
  - `LIST_UPDATED`: `listName`, `eventType`
  - `LOW_STOCK`: `itemName`, `currentQuantity`, `minQuantity`
  - `EXPIRY_REMINDER`: `itemName`, `daysUntilExpiry`, `batchNumber`, `activeBatchCount`, `isMultiBatch`, `itemCount`, `itemNames`
- **FCM values are strings.** Numbers, booleans and lists arrive as JSON text: `"3"`, `"true"`, `["Milk","Eggs"]`.
- **Size budget.** A push that would exceed the provider limit drops trailing list entries first, then all display fields. `type`, `notificationId` and the English title are always kept, so fall back to English whenever a field you need is missing.
- **iOS.** Every alert sets `aps.mutable-content: 1`.
- **Android.**
  - An alert is data-only (no `notification` block, `android.priority: high`, `data.title` / `data.body`) only for a device whose registered `appVersion` is at or above `PUSH_DATA_ONLY_MIN_ANDROID_VERSION`. Older builds keep the drawn notification.
  - The variable is unset, so no device gets data-only pushes yet. **Tell us the first build that handles them.** Keep sending `appVersion` as semver in `registerDevice` / `updateDevice`; a missing or non-semver version gets the drawn notification.
- **Coalesced push.** Carries `coalescedCount` and `coalescedTypes` (the types of the rows the English body names, in body order).
- **Authored content.** A push for an authored notification (item 9) carries `isAuthoredContent: true` and no display fields.

### 2. Role-change notification: done

Role values in every notification payload are enum member names: `CollaboratorRole` for lists, `MembershipRole` for homes.

### 3. Moderation reasons: done, with fewer enum members

- **Two members only.** `enum ModerationReasonCode { FAILED_LOGIN_ATTEMPTS, MODERATOR }`. `POLICY_VIOLATION` and `OTHER` were left out because nothing would ever send them, and a member that never arrives is a branch you can't test. Members will be added when a source for them exists.
- **Events.** `UserEvent.reasonCode` and `UserEvent.failedLoginCount` are set on `BANNED` / `UNBANNED` / `SUSPENDED` / `UNSUSPENDED` / `WARNED`. `reason` is now only the moderator's reason for that action, or null. It used to fall back to internal moderator notes, which the user could then see.
- **State.** `banReasonCode`, `suspensionReasonCode` and `restrictionReasonCode` are on `MyModerationStatus`.
- **What a banned or suspended user can see.** Such an account cannot authenticate, so it can't read its own `myModeration` while the ban or suspension is in force. The signal it gets is at sign-in: `AUTH_ACCOUNT_LOCKED` means the automatic lockout, `AUTH_ACCOUNT_SUSPENDED` means a moderator's decision. `restrictionReasonCode` is readable, because restrictions don't block sign-in.

### 4. Per-item failure codes: done, with different code names

- **Coverage.** Every type in your table carries `code: ErrorCode` and `errorId`. It is non-null on the failure types, and set exactly when `success` is false on `BatchAddShoppingListItemResult` / `BatchUpsertItemResult`.
- **Values.** A code is the value a union error member carries for the same error.
  - Deductions use `INSUFFICIENT_QUANTITY`.
  - The low-stock skip uses `ITEM_ALREADY_IN_LIST`.
  - A skipped recipe ingredient uses **`UNIT_INVALID`**, not `UNIT_CONVERSION_UNAVAILABLE`: the existing code already means "no conversion route".
  - An unexpected fault on one item uses `INTERNAL_SERVER_ERROR`.
- **Reason text.** The English reason is now masked in production like any other error. Four of these fields were sending raw exception text.
- **Breaking:** `FailedMoveInfo.code` and `BulkDeviceFailure.code` change from `String!` to `ErrorCode!`, and their values move to the union spelling: `RESOURCE_NOT_FOUND` becomes `NOT_FOUND`, `RESOURCE_CONFLICT` becomes `CONFLICT`. We found no code in the app that reads these values.
- **Breaking:** over-consumption through `createPantryItemUsage` now returns the `ValidationError` member with `code: INSUFFICIENT_QUANTITY` (was `VALIDATION_FAILED`). A conversion with no route returns `UNIT_INVALID` (was `VALIDATION_FAILED`). The `__typename` is unchanged.

### 5. `PantryItemUsage.adjustmentKind`: done, with one extra member

`enum AdjustmentKind { USER, STACK_MERGE, STACK_PURGED, STACK_REMOVED }`.

- **Which rows carry it.** Every correction row carries a kind, in both directions. A person's correction that finds stock is a `RESTOCK` row, so don't treat "has a kind" as "purpose is ADJUSTMENT". Every other row is null.
- **`STACK_REMOVED`.** Only on older rows written with the retired `PANTRY_STACK_REMOVED` marker.
- **Existing rows.** Backfilled.
- **`adjustmentReason`.** Unchanged, so the string matching in `UsageHistoryRow.tsx` keeps working until you switch to `adjustmentKind`.

### 6. `ItemValidationWarning.code`: done

`code: ItemValidationWarningCode!`, with `MISSING_DESCRIPTION`, `MISSING_UPC`, `MISSING_CATEGORY` and `MISSING_UNIT`.

### 7. Activity and invite logs: activity done; invite log already had the fields

- **`ShoppingListActivity`.** Adds typed nullable fields: `listName`, `changedFields`, `quantity`, `itemCount`, `purchasedOnly`, `collaboratorEmail`, `collaboratorRole`, `previousRole`, `newRole`. The `ShoppingListActivity` type documents which action sets which. Note that `activitiesConnection` is admin-only, so this serves admin screens.
- **`InviteLog`.** No change was needed. It already exposes `oldStatus` / `newStatus: InviteStatus` and `actor`. No server path writes invite log rows today.

### 8. `DeletionBlocker` counts: done

`memberCount` is set on `HOME_OWNERSHIP` blockers and `collaboratorCount` on `SHOPPING_LIST` blockers. Each equals the number in the message.

### 9. Admin bulk notifications: yes, marked as authored

- **The field.** `Notification.isAuthoredContent: Boolean!` is `true` when a person wrote the title and message: `bulkSendNotifications` and `createNotification`. It is `false` for everything the server builds, including `sendTestNotification`. Existing rows read `false`.
- **Types with no server writer.** `MEMBERSHIP_INVITE`, `HOME_JOINED` and the item and recipe types only ever exist as authored rows.

### Not requested

`LedgerPeriodData.periodLabel` now has the doc comment: a UTC bucket key, `YYYY-MM-DD` for daily and weekly (the Monday of the ISO week) and `YYYY-MM` for monthly.
