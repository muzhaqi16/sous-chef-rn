# Pantry tracking API alignment

Checked November 17, 2026 for `strengthen-pantry-tracking-and-consumption`, against what the API shipped.

## Evidence boundary

- C1–C5 shipped on the API's dev branch as `align-pantry-tracking-contracts`, and by Tani's call (2026-11-17) are released to dev only. Dev `:4000` serves origin/dev `f98511d7d`, `/health` schema hash `b30985d889a96edcae51a37323f7631e328a59d39bf31ccb03d3f818adb5d693`. Migrations `20261279` (cook link), `20261281` (expiry kind) and `20261283` (receipt currency) are on test and dev only.
- `@muzhaqi16/api-schema` is not published for that hash: the newest version, `4.10.0-sd2133f2adc55315d`, was built from main before any of C1–C5. The package publishes with the next production build, so the app generates from dev's schema (`src/graphql/generated/schema.graphql`) until then, and its pin stays at `4.9.7-s2e9ce2b66c5adc16`. The release check holds a store build until production serves the contracts.
- Implementing commits and tests were read on origin/dev, read-only; the API's tests were not run from here. Its CI reported unit and smoke green on dev.

## Contract gates

| Gate | As built (API commit) | Backend tests on dev | Not yet covered (with the API owner, sous-chef-api-7a) |
| --- | --- | --- | --- |
| C1: unknown receipt price | `ReceiptCheckInLineInput.totalPaid` optional (`52ef4cf25`). An unpriced line records its purchase with no price and its stock with no cost, and observes no price. A known discount may accompany it; a zero total still needs the discount that made it free. | `receipt-check-in.test.ts` "IN-01: every line lands once, and the unpriced one has no cost and observes no price"; `receiptCheckInSchema.test.ts` absent/null total passes. | An end-to-end check that the unpriced line stays out of `moneyReport` spend. |
| C2: attach receipt to a purchase | `existingPurchase { id, version }` with `stock: false` (`7253dcba3`); `purchaseId` stays the line's key. Only the buyer attaches. A contradicted fact fails on `item`, `amount`, `totalPaid`, `discount` or `storeId`; a stale version is `VERSION_CONFLICT`; resend converges. An attach answers the existing purchase's id, which differs from the `purchaseId` sent: that is the client's cue (`alreadyRecorded` is deprecated). | "IN-04: the receipt fills the moved purchase, and nothing is bought or stocked again"; buyer-only; stale version; contradicted item/total/amount. | `stock: false` and one-line-per-purchase rules; NOT_FOUND; another household's purchase; list-line mismatch; contradicting discount/store/currency; IN-04 asserting discount, line text and day filled. |
| C3: versioned/dated stock checks | `RecordPantryStockCheckInput.checkedAt`; per entry `expectedVersion`, `quantityUnitId`, `remainingNetWeight`, `remainingNetWeightUnitId`; `BatchElementFailure.field` (`456d4df78`). | `pantry-stock-check.test.ts`: CHECK-03 stale row alone; unchanged count confirms with no row or version change; replay under one key; yesterday's check keeps its time and an older one never moves confirmation back; CHECK-04; used up = correction, threw out = waste. | A replay keeping the first send's `checkedAt`; a successful `quantityUnitId` conversion; `VERSION_CONFLICT` on a USED_UP or THREW_OUT row. |
| C4: atomic planned-meal cook | `MarkRecipeAsCookedInput.mealPlanItemId` and `mealPlanItemVersion`, always together; payload `mealPlanItem`; `MealPlanItem.cookingLogId` (`a626c5b34`). `updateMealPlanItem` deducts only while `cookingLogId` is null, which fixes the double deduction on uncheck/recheck. | `mark-recipe-cooked-deduction.test.ts` "COOK-01/02", "COOK-03", resend converges, a second cook of a cooked meal is a conflict (unchecked since too), two at once; meal-plan uncheck/recheck deducts nothing more. | Edit-permission refusal; a missing meal; another household's pantry; rechecking a meal linked by `markRecipeAsCooked`. |
| C5: expiry kind | `expiryKind: ExpiryKind` (`LABEL`, `PERISHABLE_ESTIMATE`, `LONG_LIFE_ESTIMATE`) on `PantryItemBatch` and `PantryItem`, null without a date (`04c69c2f4`), folded into `quiet-estimated-expiry` request a. `LABEL` is any stated date, typed or from a receipt. Legacy dates were classified by migration `20261281`: hand-set `LABEL`, else an estimate by the 30-day window. A stack reads its earliest batch's kind; a tie reads `LABEL`. The spec follows this (Tani, 2026-11-17): no `UNKNOWN` or `RECEIPT` kind. | `intake-expiry-default.test.ts` estimates by window, entered date `LABEL`, "IN-06"; tie reads `LABEL`; `expiryKind.test.ts`. | The migration's legacy backfill; the earliest batch's kind when dates differ; `expiryKind` read through GraphQL (replay and household read-back); the kind from a receipt intake. |

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

Dependent client work builds against dev's schema and stays behind the `pantryTrackingFoundation` capability until production serves C1–C5; no route falls back to another stock-changing mutation on an old server. Tasks 3.1–3.6 close once the coverage gaps above are covered and the published package version is recorded.

## Client progress

As of 2026-11-17: tasks 1.1–1.2, 2.1–2.8, 5.1, 6.2 and 6.4 are done; 1.3 continues as each surface lands. Every intake route (barcode, restock, receipt review, list move) states its amount through the intake resolver, and the six-can example holds on each. A receipt line whose price went unread is sent with no total (C1). Device acceptance is iOS only on this machine (Tani, 2026-11-17); the full suite and whole-tree checks run in CI, not here.
