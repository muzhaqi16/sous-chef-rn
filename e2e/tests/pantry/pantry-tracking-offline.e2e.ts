/**
 * Pantry tracking when delivery goes wrong (change
 * `strengthen-pantry-tracking-and-consumption`, 8.2): a lost network, and a
 * check another member's change made stale. Judged on the row the app shows
 * and on what the API persisted. The app reaches the API through a proxy
 * the spec controls (`startApiProxy`, via the debug build's `detoxApiUrl`), so
 * it can lose an answer, cut the network and deliver a request twice. Needs
 * Metro started with `FEATURE_FLAGS=pantryTrackingFoundation=on`.
 */

import { element, by, waitFor, expect } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { openSwipeAction } from '../../helpers/actions';
import { getAuthTokens } from '../../helpers/tokenProvider';
import { launchAppWithFabricWorkaround } from '../../init';
import { generateItemName } from '../../helpers/data';
import {
  returnFromField,
  waitForModalClosed,
  waitForModalReady,
} from '../../helpers/waitFor';
import { t } from '../../helpers/i18n';
import { startApiProxy, type ApiProxy } from '../../helpers/apiProxy';
import {
  closeTrackingHome,
  confidenceOnServer,
  historyOnServer,
  homeStock,
  localDate,
  openTrackingHome,
  seedRecipe,
  seedStack,
  selectHome,
  stackOnServer,
  useOnServer,
  type SeededStack,
  type TrackingHome,
} from '../../helpers/trackingHome';
import { pantryTestIDs } from '../../../src/features/pantry/testIDs';
import { recipesTestIDs } from '../../../src/features/recipes/testIDs';
import { kitTestIDs } from '../../../src/components/testIDs';

const WAIT = 15000;
const COLD_START = 45000;
const STOCK_CHECK = 'RecordPantryStockCheck';
const USE = 'CreatePantryItemUsage';
const COOK = 'MarkRecipeAsCooked';

describe('Pantry tracking when delivery goes wrong', () => {
  let proxy: ApiProxy;
  let home: TrackingHome;
  let checked: SeededStack;
  let used: SeededStack;
  let cookEggs: SeededStack;
  let cookMilk: SeededStack;
  let recipeId: string;
  let staleMilk: SeededStack;
  let staleEggs: SeededStack;

  beforeAll(async () => {
    proxy = await startApiProxy();
    home = await openTrackingHome(generateItemName('Offline'));
    // Past its date, so the server doubts it and the check offers it.
    checked = await seedStack(home.pantryId, {
      name: generateItemName('Check'),
      quantity: 10,
      unit: 'pc',
      expiresOn: localDate(-3),
    });
    used = await seedStack(home.pantryId, {
      name: generateItemName('Use'),
      quantity: 12,
      unit: 'pc',
    });
    cookEggs = await seedStack(home.pantryId, {
      name: generateItemName('Cook eggs'),
      quantity: 12,
      unit: 'pc',
    });
    cookMilk = await seedStack(home.pantryId, {
      name: generateItemName('Cook milk'),
      quantity: 64,
      unit: 'fl oz',
    });
    recipeId = await seedRecipe({
      name: generateItemName('Scramble'),
      servings: 2,
      ingredients: [
        { name: 'Eggs', itemId: cookEggs.itemId, quantity: 2, unit: 'pc' },
        { name: 'Milk', itemId: cookMilk.itemId, quantity: 8, unit: 'fl oz' },
      ],
    });
    staleMilk = await seedStack(home.pantryId, {
      name: generateItemName('Milk'),
      quantity: 2,
      unit: 'pc',
      expiresOn: localDate(-2),
    });
    staleEggs = await seedStack(home.pantryId, {
      name: generateItemName('Eggs'),
      quantity: 12,
      unit: 'pc',
      expiresOn: localDate(-2),
    });
    await bootstrapAuthenticatedSession({ apiUrl: proxy.url });
    await selectHome(home.homeId, WAIT);
    await new PantryScreen().navigateToTab();
  });

  afterAll(async () => {
    if (home) await closeTrackingHome(home);
    await proxy?.close();
  });

  it('REL-01 applies a check once whose answer was lost, through a restart and a repeated delivery', async () => {
    const otherHome = home.previousDefaultHomeId;
    const otherBefore = otherHome ? await homeStock(otherHome) : [];

    await waitFor(element(by.id(pantryTestIDs.stockCheckEntry)))
      .toBeVisible()
      .withTimeout(WAIT);
    await element(by.id(pantryTestIDs.stockCheckEntry)).tap();
    await waitForModalReady(pantryTestIDs.stockCheckSave, WAIT);
    await element(
      by.id(pantryTestIDs.stockCheckAnswer(checked.id, 'SOME_LEFT')),
    ).tap();
    const left = element(by.id(pantryTestIDs.stockCheckLeft(checked.id)));
    await waitFor(left).toBeVisible().withTimeout(WAIT);
    await left.replaceText('6');
    await returnFromField(left, element(by.id(pantryTestIDs.stockCheckSave)));

    // The API applies the check; its answer never reaches the app.
    const lost = proxy.loseNextAnswer(STOCK_CHECK);
    const confirmedAt = Date.now();
    await element(by.id(pantryTestIDs.stockCheckSave)).tap();
    await lost;
    // Cut before the queue's retry, so the delivery left is the one after a
    // cold start.
    await proxy.goDown();

    const amount = element(by.id(pantryTestIDs.itemQuantity(checked.id)));
    await waitFor(amount).toHaveText('6 pc').withTimeout(WAIT);

    // A cold start with no network reads what the device holds.
    await bootstrapAuthenticatedSession({ apiUrl: proxy.url });
    await new PantryScreen().navigateToTab();
    await waitFor(amount).toExist().withTimeout(COLD_START);
    await expect(amount).toHaveText('6 pc');

    // The network returns; the held check is delivered, and twice.
    const repeated = proxy.repeatNext(STOCK_CHECK);
    const replayedFrom = Date.now();
    await proxy.comeBack();
    await repeated;

    jestExpect(await stackOnServer(checked.id)).toEqual({
      quantity: 6,
      unit: 'pc',
    });
    // One correction, at the time it was observed, not when it was replayed.
    const [, ...corrections] = await historyOnServer(checked.id);
    jestExpect(corrections).toHaveLength(1);
    const [correction] = corrections;
    const observedAt = Date.parse(correction?.usedAt ?? '');
    jestExpect(observedAt).toBeGreaterThanOrEqual(confirmedAt - 60_000);
    jestExpect(observedAt).toBeLessThan(replayedFrom);
    await expect(amount).toHaveText('6 pc');
    // Another home is untouched.
    if (otherHome) jestExpect(await homeStock(otherHome)).toEqual(otherBefore);
  });

  it('REL-01 applies a use once whose answer was lost, through a restart and a repeated delivery', async () => {
    const row = pantryTestIDs.item(used.id);
    const amount = element(by.id(pantryTestIDs.itemQuantity(used.id)));
    await waitFor(element(by.id(row)))
      .toBeVisible()
      .whileElement(by.id(pantryTestIDs.list))
      .scroll(200, 'down');
    await openSwipeAction(row, 'consume', pantryTestIDs.actionConfirm, WAIT);
    await element(by.id(pantryTestIDs.consumeQuantity)).replaceText('2');
    await returnFromField(
      element(by.id(pantryTestIDs.consumeQuantity)),
      element(by.id(pantryTestIDs.actionConfirm)),
    );

    // The API records the use; its answer never reaches the app.
    const lost = proxy.loseNextAnswer(USE);
    const confirmedAt = Date.now();
    await element(by.id(pantryTestIDs.actionConfirm)).tap();
    await lost;
    await proxy.goDown();
    await waitForModalClosed(pantryTestIDs.actionConfirm, WAIT);
    await waitFor(amount).toHaveText('10 pc').withTimeout(WAIT);

    // A cold start with no network reads what the device holds.
    await bootstrapAuthenticatedSession({ apiUrl: proxy.url });
    await new PantryScreen().navigateToTab();
    await waitFor(amount).toExist().withTimeout(COLD_START);
    await expect(amount).toHaveText('10 pc');

    // The network returns; the held use is delivered, and twice.
    const repeated = proxy.repeatNext(USE);
    const replayedFrom = Date.now();
    await proxy.comeBack();
    await repeated;

    jestExpect(await stackOnServer(used.id)).toEqual({
      quantity: 10,
      unit: 'pc',
    });
    // One use, at the time it was confirmed, not when it was replayed.
    const [, ...uses] = await historyOnServer(used.id);
    jestExpect(uses).toMatchObject([{ quantityUsed: 2, unit: 'pc' }]);
    const [use] = uses;
    const usedAt = Date.parse(use?.usedAt ?? '');
    jestExpect(usedAt).toBeGreaterThanOrEqual(confirmedAt - 60_000);
    jestExpect(usedAt).toBeLessThan(replayedFrom);
    await expect(amount).toHaveText('10 pc');
  });

  it('REL-01 applies a cook once whose answer was lost, through a restart and a repeated delivery', async () => {
    const tokens = await getAuthTokens();
    await launchAppWithFabricWorkaround({
      newInstance: true,
      url: `souschef://recipes/${recipeId}`,
      launchArgs: {
        detoxUserToken: tokens.accessToken,
        detoxRefreshToken: tokens.refreshToken,
        detoxUser: JSON.stringify(tokens.user),
        detoxApiUrl: proxy.url,
      },
    });
    await waitFor(element(by.id(recipesTestIDs.markCookedButton)))
      .toBeVisible()
      .withTimeout(COLD_START);
    await element(by.id(recipesTestIDs.markCookedButton)).tap();
    await waitForModalReady(recipesTestIDs.cookConfirm, WAIT);
    const servings = element(by.id(recipesTestIDs.cookServings));
    await servings.replaceText('4');
    await returnFromField(servings, element(by.id(recipesTestIDs.cookConfirm)));
    await element(by.id(recipesTestIDs.cookConfirm)).tap();
    await waitForModalReady(recipesTestIDs.cookReviewConfirm, WAIT);

    // The API records the cook; its answer never reaches the app.
    const lost = proxy.loseNextAnswer(COOK);
    await element(by.id(recipesTestIDs.cookReviewConfirm)).tap();
    await lost;
    await proxy.goDown();
    await waitForModalClosed(recipesTestIDs.cookReviewConfirm, WAIT);

    // A cold start with no network reads what the device holds: 4 servings of
    // a 2-serving recipe draw twice its 2 eggs and 8 fl oz.
    await bootstrapAuthenticatedSession({ apiUrl: proxy.url });
    await new PantryScreen().navigateToTab();
    const eggsLeft = element(by.id(pantryTestIDs.itemQuantity(cookEggs.id)));
    const milkLeft = element(by.id(pantryTestIDs.itemQuantity(cookMilk.id)));
    await waitFor(eggsLeft).toExist().withTimeout(COLD_START);
    await expect(eggsLeft).toHaveText('8 pc');
    await expect(milkLeft).toHaveText('48 fl oz');

    // The network returns; the held cook is delivered, and twice.
    const repeated = proxy.repeatNext(COOK);
    await proxy.comeBack();
    await repeated;

    jestExpect(await stackOnServer(cookEggs.id)).toEqual({
      quantity: 8,
      unit: 'pc',
    });
    jestExpect(await stackOnServer(cookMilk.id)).toEqual({
      quantity: 48,
      unit: 'fl oz',
    });
    // One cook: one use of each, as reviewed.
    const [, ...eggUses] = await historyOnServer(cookEggs.id);
    jestExpect(eggUses).toMatchObject([{ quantityUsed: 4, unit: 'pc' }]);
    const [, ...milkUses] = await historyOnServer(cookMilk.id);
    jestExpect(milkUses).toMatchObject([{ quantityUsed: 16, unit: 'fl oz' }]);
    await expect(eggsLeft).toHaveText('8 pc');
  });

  it('REL-02 keeps the confirmed milk and asks again only for the eggs another member changed', async () => {
    const entry = element(by.id(pantryTestIDs.stockCheckEntry));
    await waitFor(entry).toBeVisible().withTimeout(WAIT);
    await entry.tap();
    await waitForModalReady(pantryTestIDs.stockCheckSave, WAIT);
    const startedAt = Date.now();

    await element(
      by.id(pantryTestIDs.stockCheckAnswer(staleMilk.id, 'STILL_HAVE')),
    ).tap();
    await element(
      by.id(pantryTestIDs.stockCheckAnswer(staleEggs.id, 'SOME_LEFT')),
    ).tap();
    const eggsLeft = element(by.id(pantryTestIDs.stockCheckLeft(staleEggs.id)));
    await waitFor(eggsLeft).toBeVisible().withTimeout(WAIT);
    await eggsLeft.replaceText('6');
    await returnFromField(
      eggsLeft,
      element(by.id(pantryTestIDs.stockCheckSave)),
    );
    // While the check is open, another member uses an egg.
    await useOnServer(staleEggs.id, 1);
    await element(by.id(pantryTestIDs.stockCheckSave)).tap();

    // Only the eggs ask again.
    await waitFor(
      element(
        by.id(
          kitTestIDs.inputError(pantryTestIDs.stockCheckLeft(staleEggs.id)),
        ),
      ),
    )
      .toHaveText(t('pantryScreen.stockCheckStale'))
      .withTimeout(WAIT);
    const milk = await confidenceOnServer(staleMilk.id);
    jestExpect(milk.quantity).toBe(2);
    jestExpect(Date.parse(milk.lastConfirmedAt)).toBeGreaterThanOrEqual(
      startedAt - 60_000,
    );
    jestExpect(await stackOnServer(staleEggs.id)).toEqual({
      quantity: 11,
      unit: 'pc',
    });

    // Counting the eggs again settles them, and repeats nothing for the milk.
    await eggsLeft.replaceText('6');
    await returnFromField(
      eggsLeft,
      element(by.id(pantryTestIDs.stockCheckSave)),
    );
    await element(by.id(pantryTestIDs.stockCheckSave)).tap();
    await waitForModalClosed(pantryTestIDs.stockCheckSave, WAIT);
    jestExpect(await stackOnServer(staleEggs.id)).toEqual({
      quantity: 6,
      unit: 'pc',
    });
    jestExpect(await confidenceOnServer(staleMilk.id)).toEqual(milk);
  });
});
