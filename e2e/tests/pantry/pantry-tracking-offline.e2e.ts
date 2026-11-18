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
import { generateItemName } from '../../helpers/data';
import { waitForModalClosed, waitForModalReady } from '../../helpers/waitFor';
import { t } from '../../helpers/i18n';
import { startApiProxy, type ApiProxy } from '../../helpers/apiProxy';
import {
  closeTrackingHome,
  confidenceOnServer,
  historyOnServer,
  homeStock,
  localDate,
  openTrackingHome,
  seedStack,
  selectHome,
  stackOnServer,
  useOnServer,
  type SeededStack,
  type TrackingHome,
} from '../../helpers/trackingHome';
import { pantryTestIDs } from '../../../src/features/pantry/testIDs';
import { kitTestIDs } from '../../../src/components/testIDs';

const WAIT = 15000;
const COLD_START = 45000;
const STOCK_CHECK = 'RecordPantryStockCheck';

describe('Pantry tracking when delivery goes wrong', () => {
  let proxy: ApiProxy;
  let home: TrackingHome;
  let checked: SeededStack;
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
    await left.tapReturnKey();

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
    await eggsLeft.tapReturnKey();
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
    await eggsLeft.tapReturnKey();
    await element(by.id(pantryTestIDs.stockCheckSave)).tap();
    await waitForModalClosed(pantryTestIDs.stockCheckSave, WAIT);
    jestExpect(await stackOnServer(staleEggs.id)).toEqual({
      quantity: 6,
      unit: 'pc',
    });
    jestExpect(await confidenceOnServer(staleMilk.id)).toEqual(milk);
  });
});
