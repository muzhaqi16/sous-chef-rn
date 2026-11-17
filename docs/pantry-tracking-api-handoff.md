# Pantry tracking request to the API agent

Date: November 16, 2026. Requesting change: `strengthen-pantry-tracking-and-consumption` in the React Native repository.

## Delivery and authority

Sent on November 16, 2026 to the API session `sous-chef-api-a8`, at Tani's request, after the contract facts were checked against API `dev` 9135cd608.

**Answer (same day): all five deferred** under Tani's 2026-11-11 rule: no API, and no API plan, for client work that is not built. Nothing was proposed, coded or published. Send each contract again once the app builds against it behind `pantryTrackingFoundation`. Send C5 together with `quiet-estimated-expiry` request a, and C3 together with request d. Tani can override the deferral in the API session.

**Then taken up (same day, Tani lifted the deferral):** planned as API change `align-pantry-tracking-contracts`, strict-valid, not implemented. It starts when Tani says apply in the API session, in the order C1, C4, C3, C2, C5. Each contract returns with its schema, migrations, executed tests and package version. Agreed shape, where it differs from the requests below:
- **C2:** `existingPurchase: { id, version }`, open to the buyer or an admin only. Refusals name the field on `BatchElementFailure.field` (`amount`, `item`, `totalPaid`, `discount`, `receipt.storeId`). Quantities are compared after converting to the purchase's unit. A stocked line naming a list line another move already stocked keeps answering success (`converged: true`) with that move's purchase. Its id differing from the line's `purchaseId` is the client's cue to offer the attach.
- **C3:** each field optional on its own. A stale entry fails alone, `STILL_HAVE` included. `checkedAt` may be at most a day ahead and must fall within the 90-day replay window. Request d's `today` stays a separate field.
- **C4:** the payload gains `mealPlanItem` only. The meal exposes `cookingLogId`. It also fixes uncheck/recheck deducting again.
- **C5:** `ExpiryKind { LABEL PERISHABLE_ESTIMATE LONG_LIFE_ESTIMATE }`, with no UNKNOWN or RECEIPT. On a tie the stack takes the kind that alerts. Request g's rule runs once in the migration. `expiresAtIsManual` keeps its column: a hand-cleared batch has the flag set, no date and a null kind.

**C2(c) confirmed from code:** a stocked receipt line naming a list line already moved this cycle returns `alreadyRecorded: true` with the earlier move's purchase, and the receipt's price, store, day and quantity are dropped. No test covers this order. Today's review links only `isPurchased: false` lines (`useOpenListLinesFor.ts:47`), so the app reaches it only through a race: a move between review and submit, or a queued check-in replayed after a move.

The API checkout remains read-only under the user's instruction. This handoff is a request for its owning agent to implement through that session's authorized workflow; it does not authorize this client session to modify the sibling checkout. The API checkout also contains unrelated uncommitted work. Do not overwrite it.

Source requests: [design decisions C1–C5](../openspec/changes/strengthen-pantry-tracking-and-consumption/design.md#3-api-contract-handoff-and-compatibility-gates). Current evidence: [API alignment audit](./pantry-tracking-api-alignment.md).

## C1 — Nullable receipt cost

Change `ReceiptCheckInLineInput.totalPaid: Float!` to `Float`. Three places require a price today: the SDL, `receipt.schemas.ts`, and `prepareIntakePurchase`, whose null plan fails the line "A line states what it cost" (`ReceiptCheckInService.ts:627`). Omission/null must mean unknown throughout validation, purchases, stock arrivals and reporting. Purchases and batches already allow it: `Purchase.totalPrice` and `unitPrice` are nullable, and so is `unitCostBasis`. Do not emit an observed price or count unknown spending as zero. Preserve existing validation for known values and discounted free lines.

Acceptance: IN-01 adds 12 eggs, one 64 US fl oz carton and 10 oz spinach once; unreadable spinach price remains null. Verify replay, per-row refusal, no zero-price observation, and the existing fully discounted-line behavior. A client submitting today's non-null values must behave unchanged.

## C2 — Explicit receipt reconciliation

**Already served, and to keep:** a line naming `shoppingListItemId` whose current cycle holds the caller's own ticked purchase restates that purchase in place. The id is kept, the receipt's day, store, price and quantity are written, the price observation is replaced, and no second purchase is made (`recordUnstocked` → `recordForLine(existingPurchaseId)` → `restatePurchase`; test "a kept-out line the caller ticked is restated once"). The client already sends `shoppingListItemId` and `stock: false`.

**Gaps to close:**
- (a) An acquisition with no list line (barcode, manual add, restock).
- (b) A purchase another member ticked. Today the receipt answers with it unchanged.
- (c) A list line already moved to the pantry, checked in with `stock` on. `findAlreadyMoved` returns `alreadyInPantry`, and the receipt's facts seem to reach no purchase. This is read from code; please confirm it.
- (d) No revision check. A restate overwrites conflicting known facts.

**Requested shape:** name the selected acquisition in a field of its own, e.g. `existingPurchase: { id, version }`, and do not reuse `purchaseId`. `purchaseId` is the line's idempotency key, and `findRecorded` refuses an id another check-in holds (`IdempotencyConflictError`) before any reconciliation could run.
- Opt-in reconciliation requires `stock: false`, edit authorization, and a matching item, home and quantity.
- Compare the revision atomically.
- Fill unknown receipt and cost facts; refuse conflicting known facts for review.
- Create no purchase, arrival or batch.
- A stale, mismatched or forbidden request must never fall back to a new acquisition.
- The minted `purchaseId` stays the line's dedup key.

`stock-the-pantry-when-a-shop-ends` (client, planned) needs the same move-then-receipt agreement, gap (c), so one answer serves both.

Acceptance: IN-04 attaches a receipt to the 12-egg shopping purchase, retaining 12 eggs, one purchase and one arrival through repeated delivery. A genuine new identical purchase with its own identity must still add stock. Verify stale/forbidden/cross-household/mismatched refusals and partial row outcomes, and that the existing list-line restate behaves unchanged.

## C3 — Dated, versioned measured stock checks

Add optional `RecordPantryStockCheckInput.checkedAt: DateTime`. Add optional entry fields `expectedVersion: Int`, `quantityUnitId: ID`, `remainingNetWeight: Float` and `remainingNetWeightUnitId: ID`. New clients send original observation time and each observed revision. Measurement fields apply only to SOME_LEFT, following existing recount semantics: quantity can name its unit, and physical package count can accompany remaining contents.

The measurement fields mirror `AdjustPantryItemQuantityInput` (`newQuantityUnitId`, `remainingNetWeight`(`UnitId`)); reuse its rules and naming where they fit. `quiet-estimated-expiry` request d (not yet taken up) would add `today: LocalDate` to this same input. Please shape `checkedAt` so the two fit together, or say if one should replace the other.

Compare each row's revision atomically before any confirmation/correction. Refuse stale rows independently with `VERSION_CONFLICT`, preserving successful rows and current stock; do not automatically rebase an absolute count. Original observation time survives replay and cannot move confirmation evidence backwards. Validate dates with the API's timestamp policy. A changed answer following refusal uses a new action identity. Preserve legacy requests according to the API compatibility policy.

Acceptance: CHECK-01 corrects 10 eggs to 6 via adjustment only; CHECK-02 distinguishes confirmation, correction-to-zero, and explicit waste. CHECK-03 refuses an offline count after a newer restock without deleting that arrival. CHECK-04 records one carton with 40 fl oz remaining, held quantity 0.625 and no unopened carton. Verify replay, same-count no movement, independent stale-row failures and lost permissions. The current test that applies an answer to newer stock is legacy coverage, not acceptance of the new versioned path.

## C4 — Atomic reviewed cooking and planned-meal linkage

Add optional paired `MarkRecipeAsCookedInput.mealPlanItemId: ID` and `mealPlanItemVersion: Int`. Expose readable linked cooking-log identity on `MealPlanItem` and the updated meal/plan in the success payload. Verify recipe, pantry/home, meal revision and edit permission. Commit cooking log, reviewed deductions, linkage and completion together.

Recognize an already accepted cooking-log id before state changed by that cook can refuse the replay. A distinct log trying to complete an already linked meal must be refused with no deduction, including after unchecking it. Completion display toggles cannot restore stock or invent another cook. Return actual accepted usage rows, including skipped/capped draws; retain the paginated connection and current document-cost limits.

Acceptance: COOK-01 starts with 12 eggs/64 fl oz milk; a 2-serving recipe requiring 2 eggs/8 fl oz cooked for four servings leaves 8 eggs/48 fl oz and one cook. COOK-02 yields that same result from a planned meal and one linked completion. Concurrent second completion, response loss, replay and uncheck/recheck add no deduction. COOK-03 reports exclusions/shortfalls honestly and never automatically logs a make-up cook. Preserve the no-planned-meal input path and deduction-off cooking.

## C5 — Expiry provenance

**One field, not two.** `quiet-estimated-expiry` request a (`sous-chef-rn/openspec/changes/quiet-estimated-expiry/api-requirements.md`) already asks for the same thing. It proposes `expiryKind: ExpiryKind` (`LABEL`, `PERISHABLE_ESTIMATE`, `LONG_LIFE_ESTIMATE`) on `PantryItem` and `PantryItemBatch`, null with no date, and rests on Tani's decisions of 2026-11-05: a typed date and a guessed date differ, and guesses split at 30 days of shelf life. This change's draft proposed a different enum (`USER_PROVIDED`, `RECEIPT`, `SHELF_LIFE_ESTIMATE`, `UNKNOWN`).

Please deliver one enum and propose its final shape. What this change needs from it:
- An estimate is told apart from a typed date on batches and on the earliest-active-batch stack projection.
- The kind is recorded at write time and survives restart and household read-back.
- An undeterminable legacy row or an ambiguous earliest-batch tie reads as unknown, or as null if you prefer.

Today any supplied `expiresOn`, a receipt line's included, is stored as manual (`PantryItemCRUDService.ts:412`). Grocery receipts rarely print a date, so a separate `RECEIPT` value is wanted only if you see a write path that carries one. Request g, the backfill of the typed flag, covers the known mislabelled legacy case.

Acceptance: IN-06 starts with a shelf-life estimate and replaces it with a user-read label date; source survives reload and household read-back without any stock movement. Verify acquisition/restock, mixed batches, earliest projection, and queued replay preserving the original acquisition day. Expiry/confidence must never dispose of or consume stock automatically.

## Delivery requested from the API agent

Return each contract's accepted schema names and compatibility decisions, backend implementation/test evidence, migration requirements, published `@muzhaqi16/api-schema` version/hash, and the supported environment/release. Validate the existing supported-client operation manifests. Run API generation/build, type/lint and applicable database-backed concurrency/permission/replay tests through the API's normal scripts; distinguish inspected tests from executed passing tests.

The client may integrate each contract after its independent gate is met. Client tasks 3.1–3.6 remain open until published contracts and backend acceptance evidence are returned. Do not represent an acknowledged request or an unpublished local schema as backend delivery.
