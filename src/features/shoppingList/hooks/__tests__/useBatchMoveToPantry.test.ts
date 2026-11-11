import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { t } from '#/i18n';
import { toastService } from '#/services/toastService';
import { alertService } from '#/services/alertService';
import { Telemetry } from '#services/telemetry';
import { askForReviewAfterSuccess } from '#/domain/reviewPrompt';
import { onTutorialEvent } from '#domain/tutorialEvents';
import { MovePurchasedItemsToPantryDocument } from '../useBatchMoveToPantry.generated';
import {
  purchaseRecordOf,
  seedPurchaseRecord,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { useBatchMoveToPantry } from '../useBatchMoveToPantry';

// The OS review sheet waits out four seconds of quiet toasts, a clock this
// test does not run; `reviewPrompt.test.ts` holds that wait.
jest.mock('#/domain/reviewPrompt');

type Payload = NonNullable<
  MockDataFor<
    typeof MovePurchasedItemsToPantryDocument
  >['movePurchasedItemsToPantry']
>;
type Line = {
  __typename: 'MovePurchasedLineResult';
  shoppingListItemId: string;
  success: boolean;
  itemName: string;
  failure: {
    __typename: 'BatchElementFailure';
    code: ErrorCode;
    errorId: string | null;
  } | null;
};

const stocked = (id: string): Line => ({
  __typename: 'MovePurchasedLineResult',
  shoppingListItemId: id,
  success: true,
  itemName: id,
  failure: null,
});
const failedLine = (
  itemName: string,
  code: ErrorCode,
  errorId: string | null = null,
): Line => ({
  __typename: 'MovePurchasedLineResult',
  shoppingListItemId: `failed-${itemName}`,
  success: false,
  itemName,
  failure: { __typename: 'BatchElementFailure', code, errorId },
});

/** What the server says it did: lines moved now, moved before, and failed. */
function answered({
  moved = [],
  alreadyThere = [],
  failed = [],
}: {
  moved?: string[];
  alreadyThere?: string[];
  failed?: Line[];
}): Payload {
  return {
    __typename: 'MovePurchasedItemsToPantryPayload',
    results: [...moved, ...alreadyThere].map(stocked).concat(failed),
    summary: {
      total: moved.length + alreadyThere.length + failed.length,
      succeeded: moved.length,
      skipped: alreadyThere.length,
      failed: failed.length,
    },
  };
}

interface Move {
  /** The answer; `null` is the queue's for a write it holds. */
  answer?: Payload | null;
  /** The bought lines on screen. */
  onScreen?: string[];
  listId?: string;
  cache?: InMemoryCache;
}

/** Presses Move all on a list and lets the answer settle. */
async function moveAll({
  answer = answered({ moved: ['line-1'] }),
  onScreen = ['line-1'],
  listId = 'list-1',
  cache = makeCache(),
}: Move = {}) {
  onScreen.forEach(id => seedPurchaseRecord(cache, id));
  const sent = recordMock(MovePurchasedItemsToPantryDocument, {
    data: { movePurchasedItemsToPantry: answer },
  });
  const onSuccess = jest.fn();
  const { result } = renderHookWithApollo(
    () =>
      useBatchMoveToPantry({
        currentListId: listId || undefined,
        purchasedItems: onScreen.map(id => ({ id })),
        onSuccess,
      }),
    { operationMocks: [sent.mock], cache },
  );
  await act(async () => {
    await result.current.batchMoveToPantry();
  });
  return { sent, onSuccess, cache };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('moving every bought line to the pantry', () => {
  it('asks for a list first, and sends nothing', async () => {
    const { sent } = await moveAll({ listId: '' });

    expect(toastService.error).toHaveBeenCalledWith(
      t('moveToPantry.noListSelected'),
    );
    expect(sent.fired).toHaveLength(0);
  });

  it('sends the list, the day, and a pantry id of its own for each line on screen', async () => {
    const { sent } = await moveAll({ onScreen: ['line-1', 'line-2'] });

    const [variables] = sent.fired;
    expect(variables).toMatchObject({
      input: {
        shoppingListId: 'list-1',
        today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        pantryItemHints: [
          expect.objectContaining({ shoppingListItemId: 'line-1' }),
          expect.objectContaining({ shoppingListItemId: 'line-2' }),
        ],
      },
    });
    const hints: unknown = variables?.input;
    const ids = new Set(
      (isHinted(hints) ? hints.pantryItemHints : []).map(
        hint => hint.pantryItemId,
      ),
    );
    expect(ids.size).toBe(2);
  });

  it.each([
    [
      'what it moved',
      answered({ moved: ['line-1', 'line-2', 'line-3'] }),
      'success',
      t('moveToPantry.movedItems', { count: 3, skipped: '' }),
    ],
    [
      'what it moved, and what was there already',
      answered({ moved: ['line-1', 'line-2'], alreadyThere: ['line-3'] }),
      'success',
      t('moveToPantry.movedItems', {
        count: 2,
        skipped: t('moveToPantry.alreadyThereSuffix', { count: 1 }),
      }),
    ],
    [
      'that it was all there already',
      answered({ alreadyThere: ['line-1', 'line-2'] }),
      'info',
      t('moveToPantry.allAlreadyThere', { count: 2 }),
    ],
    [
      'that nothing was left to move',
      answered({}),
      'info',
      t('moveToPantry.nothingLeftToMove'),
    ],
    [
      'that nothing moved when every line failed',
      answered({ failed: [failedLine('bread', ErrorCode.ValidationFailed)] }),
      'info',
      t('moveToPantry.noItemsMoved'),
    ],
  ] as const)('says %s', async (_, answer, tone, said) => {
    await moveAll({ answer });

    expect(toastService[tone]).toHaveBeenCalledWith(said);
  });

  it('names up to three lines that failed, and never why', async () => {
    await moveAll({
      answer: answered({
        moved: ['line-1'],
        failed: ['bread', 'milk', 'eggs', 'jam'].map(name =>
          failedLine(name, ErrorCode.ValidationFailed),
        ),
      }),
    });

    expect(toastService.error).toHaveBeenCalledWith(
      t('moveToPantry.failedItems', { count: 4, names: 'bread, milk, eggs' }),
    );
  });

  it('records what moved, and why lines failed, which the person never sees', async () => {
    await moveAll({
      answer: answered({
        moved: ['line-1'],
        alreadyThere: ['line-2'],
        failed: [
          failedLine('bread', ErrorCode.ValidationFailed, 'log-42'),
          failedLine('milk', ErrorCode.InternalServerError, 'log-43'),
          failedLine('eggs', ErrorCode.ValidationFailed),
        ],
      }),
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'batch_move_purchased_to_pantry',
      {
        shopping_list_id: 'list-1',
        moved_count: 1,
        already_in_pantry_count: 1,
        failed_count: 3,
        // Distinct and sorted: three failures, two causes.
        failed_codes: `${ErrorCode.InternalServerError},${ErrorCode.ValidationFailed}`,
        // Only the ids that exist.
        failed_error_ids: 'log-42,log-43',
      },
    );
  });

  it('closes, asks for a review, and tells the guide once something moved', async () => {
    const heard = jest.fn();
    const stop = onTutorialEvent(heard);

    const { onSuccess } = await moveAll();
    stop();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(askForReviewAfterSuccess).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('list.movedToPantry');
  });

  it('closes on a move that moved nothing, asking for no review', async () => {
    const { onSuccess } = await moveAll({ answer: answered({}) });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(askForReviewAfterSuccess).not.toHaveBeenCalled();
  });

  it('stays open on a refusal, which it alerts, changing nothing', async () => {
    const cache = makeCache();
    const { onSuccess } = await moveAll({
      cache,
      answer: {
        __typename: 'ForbiddenError',
        code: ErrorCode.Forbidden,
        message: 'No',
      },
    });

    expect(alertService.alert).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(askForReviewAfterSuccess).not.toHaveBeenCalled();
    expect(purchaseRecordOf(cache, 'line-1')?.movedToPantryAt).toBeNull();
  });

  // The input names only the list, and the lines on screen are one page of it,
  // so a queued move cannot know how many the server will move.
  it('says a queued move will go once online, with no count, and closes', async () => {
    const { onSuccess } = await moveAll({ answer: null });

    expect(toastService.success).toHaveBeenCalledWith(t('moveToPantry.queued'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(askForReviewAfterSuccess).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});

describe('the moved lines, in the cache', () => {
  it('are stamped, so their rows stop offering the move', async () => {
    const { cache } = await moveAll();

    expect(purchaseRecordOf(cache, 'line-1')?.movedToPantryAt).toEqual(
      expect.any(String),
    );
  });

  // The payload lists lines an earlier move stocked, with their real time.
  it('keep the stamp of an earlier move', async () => {
    const cache = makeCache();
    seedPurchaseRecord(cache, 'line-1', {
      movedToPantryAt: '2026-08-01T09:00:00.000Z',
    });

    await moveAll({
      cache,
      onScreen: [],
      answer: answered({ alreadyThere: ['line-1'] }),
    });

    expect(purchaseRecordOf(cache, 'line-1')?.movedToPantryAt).toBe(
      '2026-08-01T09:00:00.000Z',
    );
  });

  it('are not stamped when they failed', async () => {
    const { cache } = await moveAll({
      onScreen: ['failed-bread'],
      answer: answered({
        failed: [failedLine('bread', ErrorCode.ValidationFailed)],
      }),
    });

    expect(purchaseRecordOf(cache, 'failed-bread')?.movedToPantryAt).toBeNull();
  });

  // Unticked here (offline, or mid-move) while the server still moved it:
  // asserting the flag would clear the amounts the server recorded.
  it.each([
    ['bought', true],
    ['unticked here', false],
  ])('keep what was paid for a line %s', async (_, isPurchased) => {
    const cache = makeCache();
    seedPurchaseRecord(cache, 'line-1', {
      isPurchased,
      purchasedQuantity: 7,
      purchasedPrice: 4.5,
    });

    await moveAll({ cache, onScreen: [] });

    expect(purchaseRecordOf(cache, 'line-1')).toMatchObject({
      purchasedQuantity: 7,
      purchasedPrice: 4.5,
    });
  });
});

function isHinted(
  input: unknown,
): input is { pantryItemHints: { pantryItemId: string }[] } {
  return (
    typeof input === 'object' &&
    input !== null &&
    'pantryItemHints' in input &&
    Array.isArray(input.pantryItemHints)
  );
}
