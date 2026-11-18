/**
 * Pantry tracking (change `strengthen-pantry-tracking-and-consumption`, 8.1),
 * judged on the row the app shows and on what the API persisted. Each run
 * opens a home of its own as the test user's default, so the stock check and
 * the rows hold only what it seeds. Needs Metro started with
 * `FEATURE_FLAGS=pantryTrackingFoundation=on`.
 */

import { element, by, waitFor, expect } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { PantryScreen } from '../../screens/PantryScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { getAuthTokens } from '../../helpers/tokenProvider';
import { launchAppWithFabricWorkaround } from '../../init';
import { generateItemName } from '../../helpers/data';
import { waitForModalClosed, waitForModalReady } from '../../helpers/waitFor';
import {
  closeTrackingHome,
  localDate,
  openTrackingHome,
  seedRecipe,
  pantryStacks,
  seedStack,
  selectHome,
  stackOnServer,
  type SeededStack,
  type TrackingHome,
} from '../../helpers/trackingHome';
import { pantryTestIDs } from '../../../src/features/pantry/testIDs';
import { recipesTestIDs } from '../../../src/features/recipes/testIDs';
import { kitTestIDs } from '../../../src/components/testIDs';

const WAIT = 15000;

describe('Pantry tracking', () => {
  let home: TrackingHome;
  let eggs: SeededStack;
  let checked: SeededStack;
  let cookEggs: SeededStack;
  let cookMilk: SeededStack;
  let carton: SeededStack;
  let recipeId: string;

  beforeAll(async () => {
    home = await openTrackingHome(generateItemName('Tracking'));
    eggs = await seedStack(home.pantryId, {
      name: generateItemName('Eggs'),
      quantity: 12,
      unit: 'pc',
    });
    // Past its date, so the server doubts it and the check offers it.
    checked = await seedStack(home.pantryId, {
      name: generateItemName('Check'),
      quantity: 10,
      unit: 'pc',
      expiresOn: localDate(-3),
    });
    cookEggs = await seedStack(home.pantryId, {
      name: generateItemName('Cook eggs'),
      quantity: 12,
      unit: 'pc',
    });
    carton = await seedStack(home.pantryId, {
      name: generateItemName('Carton'),
      packages: {
        count: 1,
        unit: 'carton',
        size: { quantity: 64, unit: 'fl oz' },
      },
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
    await bootstrapAuthenticatedSession();
    await selectHome(home.homeId, WAIT);
    await new PantryScreen().navigateToTab();
    await waitFor(element(by.id(pantryTestIDs.item(eggs.id))))
      .toBeVisible()
      .withTimeout(WAIT);
  });

  afterAll(async () => {
    if (home) await closeTrackingHome(home);
  });

  it('USE-01 uses 2 of 12 eggs in one confirmation', async () => {
    const row = pantryTestIDs.item(eggs.id);
    await element(by.id(row)).swipe('right', 'slow', 0.5);
    const consume = kitTestIDs.swipeAction(row, 'consume');
    await waitFor(element(by.id(consume)))
      .toBeVisible()
      .withTimeout(WAIT);
    await element(by.id(consume)).tap();
    await waitForModalReady(pantryTestIDs.actionConfirm, WAIT);
    await element(by.id(pantryTestIDs.consumeQuantity)).replaceText('2');
    // The field lets go first, as a household's return key does: Detox's tap
    // on the bar's Confirm does nothing while the field still holds focus.
    await element(by.id(pantryTestIDs.consumeQuantity)).tapReturnKey();
    await element(by.id(pantryTestIDs.actionConfirm)).tap();
    await waitForModalClosed(pantryTestIDs.actionConfirm, WAIT);

    await waitFor(element(by.id(pantryTestIDs.itemQuantity(eggs.id))))
      .toHaveText('10 pc')
      .withTimeout(WAIT);
    await expect(
      element(by.id(pantryTestIDs.itemQuantity(eggs.id))),
    ).toHaveText('10 pc');
    jestExpect(await stackOnServer(eggs.id)).toEqual({
      quantity: 10,
      unit: 'pc',
    });
  });

  it('USE-02 uses 8 fl oz of one unopened 64 fl oz carton', async () => {
    const row = pantryTestIDs.item(carton.id);
    await waitFor(element(by.id(row)))
      .toBeVisible()
      .whileElement(by.id(pantryTestIDs.list))
      .scroll(200, 'down');
    await element(by.id(row)).swipe('right', 'slow', 0.5);
    const consume = kitTestIDs.swipeAction(row, 'consume');
    await waitFor(element(by.id(consume)))
      .toBeVisible()
      .withTimeout(WAIT);
    await element(by.id(consume)).tap();
    await waitForModalReady(pantryTestIDs.actionConfirm, WAIT);
    // A carton is used in what it holds: fl oz is offered, so only the amount
    // is typed.
    await element(by.id(pantryTestIDs.consumeQuantity)).replaceText('8');
    await element(by.id(pantryTestIDs.consumeQuantity)).tapReturnKey();
    await element(by.id(pantryTestIDs.actionConfirm)).tap();
    await waitForModalClosed(pantryTestIDs.actionConfirm, WAIT);

    const amount = element(by.id(pantryTestIDs.itemQuantity(carton.id)));
    await waitFor(amount).toHaveText('56 fl oz').withTimeout(WAIT);
    const held = (await pantryStacks(home.pantryId)).find(
      stack => stack.id === carton.id,
    );
    jestExpect(held).toMatchObject({
      heldQuantity: 0.875,
      unit: 'carton',
      remainingNetWeight: 56,
      netWeightUnit: 'fl oz',
      amountLeft: { value: 56, unit: 'fl oz' },
      fullPackages: 0,
      activeBatchCount: 1,
    });

    // The same remainder on its detail, and after the app restarts.
    await element(by.id(row)).tap();
    await waitFor(element(by.id(pantryTestIDs.detailAmount)))
      .toHaveText('56 fl oz')
      .withTimeout(WAIT);
    await element(by.id(kitTestIDs.headerBackButton)).tap();
    await bootstrapAuthenticatedSession();
    await new PantryScreen().navigateToTab();
    // The list mounts under its skeleton once the restored stacks lay out.
    await waitFor(element(by.id(row)))
      .toExist()
      .withTimeout(WAIT);
    await waitFor(element(by.id(row)))
      .toBeVisible()
      .whileElement(by.id(pantryTestIDs.list))
      .scroll(200, 'down');
    await expect(amount).toHaveText('56 fl oz');
  });

  it('CHECK-01 counts 6 of 10 recorded eggs with Some left', async () => {
    await waitFor(element(by.id(pantryTestIDs.stockCheckEntry)))
      .toBeVisible()
      .withTimeout(WAIT);
    await element(by.id(pantryTestIDs.stockCheckEntry)).tap();
    // Settled before a chip is pressed: a tap while the sheet slides in misses.
    await waitForModalReady(pantryTestIDs.stockCheckSave, WAIT);
    const someLeft = pantryTestIDs.stockCheckAnswer(checked.id, 'SOME_LEFT');
    await element(by.id(someLeft)).tap();
    await waitFor(element(by.id(pantryTestIDs.stockCheckLeft(checked.id))))
      .toBeVisible()
      .withTimeout(WAIT);
    const left = element(by.id(pantryTestIDs.stockCheckLeft(checked.id)));
    await left.replaceText('6');
    await left.tapReturnKey();
    await element(by.id(pantryTestIDs.stockCheckSave)).tap();

    await waitFor(element(by.id(pantryTestIDs.itemQuantity(checked.id))))
      .toHaveText('6 pc')
      .withTimeout(WAIT);
    jestExpect(await stackOnServer(checked.id)).toEqual({
      quantity: 6,
      unit: 'pc',
    });
  });

  it('COOK-01 cooks 4 servings of a 2-serving recipe once', async () => {
    // A cold start with the link is the form Detox routes reliably; the app
    // reopens on the spec's home, now its default.
    const tokens = await getAuthTokens();
    await launchAppWithFabricWorkaround({
      newInstance: true,
      url: `souschef://recipes/${recipeId}`,
      launchArgs: {
        detoxUserToken: tokens.accessToken,
        detoxRefreshToken: tokens.refreshToken,
        detoxUser: JSON.stringify(tokens.user),
      },
    });
    await waitFor(element(by.id(recipesTestIDs.markCookedButton)))
      .toBeVisible()
      .withTimeout(WAIT);
    await element(by.id(recipesTestIDs.markCookedButton)).tap();
    await waitForModalReady(recipesTestIDs.cookConfirm, WAIT);
    const servings = element(by.id(recipesTestIDs.cookServings));
    await servings.replaceText('4');
    await servings.tapReturnKey();
    await element(by.id(recipesTestIDs.cookConfirm)).tap();
    await waitForModalReady(recipesTestIDs.cookReviewConfirm, WAIT);
    await element(by.id(recipesTestIDs.cookReviewConfirm)).tap();
    await waitForModalClosed(recipesTestIDs.cookReviewConfirm, WAIT);

    // 4 servings of a 2-serving recipe: twice its 2 eggs and 8 fl oz.
    jestExpect(await stackOnServer(cookEggs.id)).toEqual({
      quantity: 8,
      unit: 'pc',
    });
    jestExpect(await stackOnServer(cookMilk.id)).toEqual({
      quantity: 48,
      unit: 'fl oz',
    });
    // A reload replays the launch link; a cold start without it shows the tabs.
    await bootstrapAuthenticatedSession();
    await new PantryScreen().navigateToTab();
    await waitFor(element(by.id(pantryTestIDs.itemQuantity(cookEggs.id))))
      .toHaveText('8 pc')
      .withTimeout(WAIT);
  });
});
