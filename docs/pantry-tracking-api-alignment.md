# Pantry tracking API alignment

Checked November 17, 2026 for `strengthen-pantry-tracking-and-consumption`, against what the API shipped.

## Evidence boundary

- C1–C5 shipped on the API's dev branch as `align-pantry-tracking-contracts`, and by Tani's call (2026-11-17) are released to dev only. Dev `:4000` serves origin/dev `f98511d7d`, `/health` schema hash `b30985d889a96edcae51a37323f7631e328a59d39bf31ccb03d3f818adb5d693`. Migrations `20261279` (cook link), `20261281` (expiry kind) and `20261283` (receipt currency) are on test and dev only.
- `@muzhaqi16/api-schema` is not published for that hash: the newest version, `4.10.0-sd2133f2adc55315d`, was built from main before any of C1–C5. The package publishes with the next production build, so the app generates from dev's schema (`src/graphql/generated/schema.graphql`) until then, and its pin stays at `4.9.7-s2e9ce2b66c5adc16`. The release check holds a store build until production serves the contracts.
- Implementing commits and tests were read on origin/dev, read-only; the API's tests were not run from here. Its CI reported unit and smoke green on dev.

## Contract gates

| Gate | As built (API commit) | Backend tests on dev | Added for the app's review (`adfd7fee1`, `40d9c0c2c`; full integration run 44135082047 green) |
| --- | --- | --- | --- |
| C1: unknown receipt price | `ReceiptCheckInLineInput.totalPaid` optional (`52ef4cf25`). An unpriced line records its purchase with no price and its stock with no cost, and observes no price. A known discount may accompany it; a zero total still needs the discount that made it free. | `receipt-check-in.test.ts` "IN-01: every line lands once, and the unpriced one has no cost and observes no price"; `receiptCheckInSchema.test.ts` absent/null total passes. | An unpriced check-in line counts in `moneyReport`'s purchase and unpriced counts, never in spend, end to end. |
| C2: attach receipt to a purchase | `existingPurchase { id, version }` with `stock: false` (`7253dcba3`); `purchaseId` stays the line's key. Only the buyer attaches. A contradicted fact fails on `item`, `amount`, `totalPaid`, `discount` or `storeId`; a stale version is `VERSION_CONFLICT`; resend converges. An attach answers the existing purchase's id, which differs from the `purchaseId` sent: that is the client's cue (`alreadyRecorded` is deprecated). | "IN-04: the receipt fills the moved purchase, and nothing is bought or stocked again"; buyer-only; stale version; contradicted item/total/amount. | `stock: false` and one-line-per-purchase refusals; a missing purchase is NOT_FOUND; another household's purchase fails on `existingPurchase.id`; another list line, discount or store fails on its field; the same price in another currency fails on `totalPaid`; IN-04 asserts discount, line text and day filled. |
| C3: versioned/dated stock checks | `RecordPantryStockCheckInput.checkedAt`; per entry `expectedVersion`, `quantityUnitId`, `remainingNetWeight`, `remainingNetWeightUnitId`; `BatchElementFailure.field` (`456d4df78`). | `pantry-stock-check.test.ts`: CHECK-03 stale row alone; unchanged count confirms with no row or version change; replay under one key; yesterday's check keeps its time and an older one never moves confirmation back; CHECK-04; used up = correction, threw out = waste. | A replay keeps its first `checkedAt`; 0.25 kg into a gram stack sets 250; a stale USED_UP or THREW_OUT is `VERSION_CONFLICT` and removes nothing. A SOME_LEFT recount that changes only a weighed stack's contents writes no usage row, as `adjustPantryItemQuantity`. |
| C4: atomic planned-meal cook | `MarkRecipeAsCookedInput.mealPlanItemId` and `mealPlanItemVersion`, always together; payload `mealPlanItem`; `MealPlanItem.cookingLogId` (`a626c5b34`). `updateMealPlanItem` deducts only while `cookingLogId` is null, which fixes the double deduction on uncheck/recheck. | `mark-recipe-cooked-deduction.test.ts` "COOK-01/02", "COOK-03", resend converges, a second cook of a cooked meal is a conflict (unchecked since too), two at once; meal-plan uncheck/recheck deducts nothing more. | A guest who may not edit the plan is FORBIDDEN with nothing written; a missing meal is NOT_FOUND; another household's pantry fails on `pantryId`; a cook-linked meal unchecked and checked again draws nothing. |
| C5: expiry kind | `expiryKind: ExpiryKind` (`LABEL`, `PERISHABLE_ESTIMATE`, `LONG_LIFE_ESTIMATE`) on `PantryItemBatch` and `PantryItem`, null without a date (`04c69c2f4`), folded into `quiet-estimated-expiry` request a. `LABEL` is any stated date, typed or from a receipt. Legacy dates were classified by migration `20261281`: hand-set `LABEL`, else an estimate by the 30-day window. A stack reads its earliest batch's kind; a tie reads `LABEL`. The spec follows this (Tani, 2026-11-17): no `UNKNOWN` or `RECEIPT` kind. | `intake-expiry-default.test.ts` estimates by window, entered date `LABEL`, "IN-06"; tie reads `LABEL`; `expiryKind.test.ts`. | A stack reads its earliest-dated batch's kind; another member reads `expiryKind` through `pantryItem` and `pantryItemBatchesConnection` after a replayed add; a receipt's stated date reads `LABEL`. The legacy backfill has no test; its counts were verified on test and dev when applied (no dated row without a kind, `LABEL` exactly where the manual flag was set). |

## Source and acceptance references

- Receipt input and validation: `../sous-chef-api/packages/schema/src/typedefs/inputs/receipt.ts:81`, `../sous-chef-api/packages/schema/src/resolvers/validators/receipt.schemas.ts:96`.
- Existing-purchase rejection: `../sous-chef-api/packages/core/src/services/receipt/ReceiptCheckInService.ts:324`.
- Receipt tests cover discounted/free lines, multipacks, concurrent delivery and row replay: `../sous-chef-api/tests/integration/receipt/receipt-check-in.test.ts`.
- Stock-check contract/service: `../sous-chef-api/packages/schema/src/typedefs/mutations/pantryStockCheck.ts`, `../sous-chef-api/packages/core/src/services/pantry/PantryStockCheckService.ts:151`.
- Existing stock-check tests cover corrections, waste, permissions and replay. The test at `../sous-chef-api/tests/integration/pantry/pantry-stock-check.test.ts:517` explicitly applies a count to the current stack, demonstrating why CHECK-03 needs a new contract.
- Cooking contract: `../sous-chef-api/packages/schema/src/typedefs/mutations/quantity.ts:7`; related tests in `../sous-chef-api/tests/integration/pantry/mark-recipe-cooked-deduction.test.ts` and `../sous-chef-api/tests/integration/sync/recipe-cooking-sync.test.ts`.
- Expiry storage: `../sous-chef-api/prisma/schema/pantryItemBatch.prisma:53`.

## Overlaps with other planned changes

Checked against `openspec/changes` on 2026-11-16. Each needs one owner before an API request goes out:

- **Stock confidence and the check:** `keep-stale-stock-honest` (rows, list subtraction) and `check-before-you-shop` (the check, Phase 2 of `retention-roadmap-10-weeks`) already specify section 7 of this change, with different parameters. This change uses five rows, opened from Pantry/Today, and the recount UI with C3 for Some left. `check-before-you-shop` uses ten rows, opened from list/store mode/Today, with ¼/½/¾ fractions on today's unversioned write. Both extend the stock-check `LocalWrite` that `quiet-estimated-expiry` adds. Only this change guards against stale offline counts (CHECK-03).
- **Expiry kind:** C5 against `quiet-estimated-expiry` request a (above).
- **Receipt after a list move:** C2 against `stock-the-pantry-when-a-shop-ends` ("a receipt line that matches a moved line joins it").
- **Delivery policy:** on 2026-11-11 `quiet-estimated-expiry` requests a and d–g were "not taken up: no API for client work not yet built; send again once the app builds against it". Expect the same answer for C1–C5 until the client work each one serves is built.

## External baseline (2026-11-16)

- Grocy (4.7.1) keeps purchase, consume, open and inventory-correction bookings separate, sets an inventory count as an absolute amount and books the difference, keeps batches with their own date and price, and consumes opened first, then first due, then first in. It also takes an explicit entry, makes price optional, and lets a unit with no conversion simply not be chosen. The plan matches each of these. Two differences: Grocy has per-booking undo (this change rules undo out, and the public schema has no undo of a use), and Grocy has a best-before/expiration "due date type", which neither expiry enum carries.
- No reviewed tracker documents stale counts from several users. ERP cycle counting reconciles a count against transactions posted after its snapshot (Epicor, Sage Intacct, NetSuite, Dynamics GP), so C3's version plus observation time follows established practice.

## Implementation boundary

Dependent client work builds against dev's schema and stays behind the `pantryTrackingFoundation` capability until production serves C1–C5; no route falls back to another stock-changing mutation on an old server. Tasks 3.1–3.5 are met by the tests above. Task 3.6 closes when the published package version is recorded. A unitless whole count is packages only where an add names no unit (a receipt's "1"); where a list line or stack states a unit, as on a list move or a restock, it means that unit.

## Two members on dev (task 8.3)

Run 2026-11-18 against dev `:4000` (hash `b30985d8…`) as two member accounts of a fresh home, judged on the persisted stack and its ledger rows, not on client totals. 34 of 34 checks held:

- **USE-06:** uses of 2 and 3 eggs sent at once leave 7. There are two usage rows, each naming its own member, and resending both keys answers the same two rows. With 2 left, uses of 2 and 3 sent at once: the 2 lands, the 3 is `InsufficientQuantityError`, and the stack stops at 0 with one row.
- **CHECK-03, REL-02, REL-01:** one member counts 10 eggs as 6 at version v. The other restocks 6 before that check lands, and the check also states a milk Still have:
  - the milk row lands;
  - the egg row is `VERSION_CONFLICT`, the restocked 16 stands, and no correction is written.
  - A fresh count of 6 then corrects 16 to 6 with one `ADJUSTMENT` of 10 and no consumption. Its replay under the same key converges.
- **COOK-02, atomic failure:**
  - A cook stating a stale meal version is `VERSION_CONFLICT`: no stock moves, and the meal stays open with no cook.
  - The cook at the read version completes the meal with its `cookingLogId` and draws 4 eggs once. Its replay converges.
  - The other member's new cook of that meal is `CONFLICT`.
  - Unchecking and checking the meal again leaves 8 eggs and the same cook.
- **REL-03, H2/P2:**
  - A member cannot use, or check, a stack in a home they are not in, and that stack is unchanged.
  - With pantry edits turned off for the second member, their use is `ForbiddenError`, their check is refused, and the stack is unchanged.

The run was a one-off script against the dev API, kept outside the repository.

## Device acceptance on iOS (task 8.4, in progress)

iOS simulator (iPhone 18 Pro, iOS 27), debug build on dev with `pantryTrackingFoundation=on`, 2026-11-18. Each outcome below was read back from the server.

- **USE-01:** the compact consume sheet opened on a 12-egg stack with `pc` preselected, a prefilled amount, the remainder ("Remaining: 11 pc"), Use all, and the details collapsed. Changing the amount to 2 and confirming left 10, with one usage of 2 pc and no note typed.
- **USE-02:** on one 64 fl oz carton the sheet led with fl oz. A use of 8 read "Remaining: 56 fl oz" before confirming. After it, the row and detail read 1.66 L (56 fl oz in a metric reading), with 1 package of 1.89 L (64 fl oz). The server holds quantity 1, held 0.875, 56 remaining and 0 unopened.
- **COOK-02:** checking a planned recipe meal opened the recipe's own cook, with Smart Deduction. Its review proposed 4 eggs for 4 servings of a 2-serving recipe, and confirming said "Deducted 1 ingredient from pantry". The meal showed done at once. The server holds 8 eggs, one `COOKING` row of 4, and the meal's `cookingLogId`. Unchecking and checking the meal again opened no cook and drew nothing.
- **IN, list move:** a purchased list line of 12 pc opened Move to Pantry filled in: the pantry, 12 and `pc`. It was confirmed with nothing typed, and the stack went from 8 to 20.
- **Localized copy:** in Albanian the compact consume sheet fits with nothing cut ("Konsumo artikullin", "Mbetet: 7 copë", "Përdor të gjitha"). Switching language exposed a bug, fixed in `d74c1ee19`: rows the change feed held kept the old language's unit labels ("10 copë" back in English) until each row changed. A switch now reads every held scope in full; on the device, every row followed both ways without a reload.
- **Field and keyboard:** the amount field stays above the keyboard. Finding: every form sheet renders its header (Cancel/Confirm) inside its scrolling content, 18 of them. When a focused field scrolls into view, the header goes up under the status bar, so Confirm takes a tap to close the keyboard first. This is a kit change (a fixed header slot in `Sheet`), not one sheet's.
- **CHECK, five rows:** six stacks 3 days past their date (LOW, `PAST_EXPIRY`). The banner offered five, in the server's order, and the sixth stayed reachable once those were answered. Answers were Threw out, Some left 4, Used up and Still have, with one row left unanswered. Save was enabled and the rows moved at once (0, 4, 0, 10). The server agreed (0, 4, 0, 10), and the unanswered row was untouched. Bug fixed in `fb0cf6af9`: the banner kept "5 items to check" until the next resync. The check's answer now restates the list, and a queued check drops the stacks it emptied; on the device the count went 4 → 3 within 0.2 s of Save. A confirmed stack past its date stays in the check, as design §7 allows. The answer chips scroll sideways in English, and the last chip ends inside the gutter.
- **Not yet observed:** offline banners. The simulator reaches the API on localhost, so only stopping the API makes it unavailable, and that waits on a go.

## Schema version and rollout

- **Reads need dev's schema.** Documents select C1–C5 fields: `expiryKind` (in `PantryItemReaders` and the batch fragment), `MealPlanItem.cookingLogId`, `markRecipeAsCooked`'s `mealPlanItem` and cook rows, and the stock check's fields. A build from this tree validates only against a server at hash `b30985d8…` or later, so the release check holds a store build until production serves it.
- **Writes queued by an older build replay unchanged.** Every input only gained optional fields (`totalPaid` optional, `existingPurchase`, `checkedAt` and the per-row version, `mealPlanItemId` with its version). A cook queued before C4 names no meal and completes none. Nothing rewrites an enqueued write.
- **Entry points stay behind `pantryTrackingFoundation`.** Off, a planned meal completes through `updateMealPlanItem` as before, and Pantry offers no stock check. Roll back by switching it off: queued work settles through its registered local writes either way.
- **Missing evidence is unknown, never stated.** No expiry kind is no date (a date typed on a row made offline reads `LABEL`). A stack with no confidence answer has no level, and a check the device never read is offline, not empty. An unread price stays null, never zero.

## Client progress

As of 2026-11-17: tasks 1.1–2.8, 4.2–4.4, 5.1–5.5, 6.1–6.6 and 7.1–7.6 are done. Every intake route (barcode, restock, receipt review, list move) states its amount through the intake resolver, and the six-can example holds on each. A receipt line whose price went unread is sent with no total (C1). A recipe is cooked one way from its page or a planned meal, the meal completed in the cook itself (C4), and a cook reports what each stack recorded. Device acceptance is iOS only on this machine (Tani, 2026-11-17); the full suite and whole-tree checks run in CI, not here. Tasks 3.6 and 4.1 wait for the published package.
