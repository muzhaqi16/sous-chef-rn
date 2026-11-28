import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { kitTestIDs } from '#components/testIDs';
import {
  ErrorCode,
  StockCheckAnswer,
  StockConfidence,
} from '#graphql/generated/schemaTypes';
import { t } from '#i18n';
import {
  RecordPantryStockCheckDocument,
  StockToConfirmDocument,
} from '../../hooks/useStockCheck.generated';
import { pantryTestIDs } from '../../testIDs';
import { StockCheckSheet } from '../StockCheckSheet';

jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'P1', name: 'Kitchen' },
    currentHome: { id: 'H1' },
  }),
}));
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-11-15' }));

const stack = (id: string, version: number) => ({
  id,
  version,
  itemName: id,
  unit: { id: 'unit-piece', symbol: 'pc' },
  packageSize: null,
  netWeightUnit: null,
  stockConfidence: {
    level: StockConfidence.Low,
    reasons: [],
    lastConfirmedAt: '2026-11-01T09:00:00.000Z',
  },
});

const toCheck = (...stacks: ReturnType<typeof stack>[]) =>
  recordMock(StockToConfirmDocument, {
    data: { pantry: { id: 'P1', stockToConfirm: stacks } },
  });

const pick = (id: string, answer: StockCheckAnswer) =>
  fireEvent.press(
    screen.getByTestId(pantryTestIDs.stockCheckAnswer(id, answer)),
  );

const save = async () => {
  fireEvent.press(screen.getByTestId(pantryTestIDs.stockCheckSave));
  await drainTimers();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('records Threw out with the reason picked', async () => {
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: { recordPantryStockCheck: null },
  });
  const onDismiss = jest.fn();
  renderWithApollo(<StockCheckSheet visible onDismiss={onDismiss} />, {
    operationMocks: [toCheck(stack('eggs', 4)).mock, recorded.mock],
  });
  await drainTimers();

  pick('eggs', StockCheckAnswer.ThrewOut);
  // Prefilled as the waste sheet is, and changed in two taps.
  fireEvent.press(screen.getByText(t('labels.expired')));
  fireEvent.press(screen.getByText(t('labels.mold')));
  await save();

  expect(inputOf(recorded.fired[0]!)).toMatchObject({
    entries: [
      { pantryItemId: 'eggs', answer: 'THREW_OUT', wasteReason: 'MOLD' },
    ],
  });
  expect(onDismiss).toHaveBeenCalled();
});

it("keeps a refused row's answer open and says why", async () => {
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: {
      recordPantryStockCheck: {
        __typename: 'RecordPantryStockCheckPayload',
        results: [
          { pantryItemId: 'eggs', success: true, failure: null },
          {
            pantryItemId: 'milk',
            success: false,
            failure: { code: ErrorCode.VersionConflict },
            pantryItem: null,
          },
        ],
      },
    },
  });
  const onDismiss = jest.fn();
  renderWithApollo(<StockCheckSheet visible onDismiss={onDismiss} />, {
    operationMocks: [
      toCheck(stack('eggs', 4), stack('milk', 7)).mock,
      recorded.mock,
    ],
  });
  await drainTimers();

  pick('eggs', StockCheckAnswer.StillHave);
  pick('milk', StockCheckAnswer.UsedUp);
  await save();

  expect(screen.getByText(t('pantryScreen.stockCheckStale'))).toBeTruthy();
  expect(
    screen.getByTestId(
      pantryTestIDs.stockCheckAnswer('milk', StockCheckAnswer.UsedUp),
    ),
  ).toBeSelected();
  expect(onDismiss).not.toHaveBeenCalled();
});

it('says why a counted row was refused on its amount, the field checked again', async () => {
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: {
      recordPantryStockCheck: {
        __typename: 'RecordPantryStockCheckPayload',
        results: [
          {
            pantryItemId: 'eggs',
            success: false,
            failure: { code: ErrorCode.VersionConflict },
            pantryItem: null,
          },
        ],
      },
    },
  });
  renderWithApollo(<StockCheckSheet visible onDismiss={jest.fn()} />, {
    operationMocks: [toCheck(stack('eggs', 4)).mock, recorded.mock],
  });
  await drainTimers();

  pick('eggs', StockCheckAnswer.SomeLeft);
  fireEvent.changeText(
    screen.getByTestId(pantryTestIDs.stockCheckLeft('eggs')),
    '6',
  );
  await save();

  expect(
    screen.getByTestId(
      kitTestIDs.inputError(pantryTestIDs.stockCheckLeft('eggs')),
    ),
  ).toHaveTextContent(t('pantryScreen.stockCheckStale'));
  expect(screen.getByTestId(pantryTestIDs.stockCheckLeft('eggs'))).toHaveProp(
    'value',
    '6',
  );
});

// The server names the input it refused: what is left inside, not the count.
it('says why on the field the server names', async () => {
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: {
      recordPantryStockCheck: {
        __typename: 'RecordPantryStockCheckPayload',
        results: [
          {
            pantryItemId: 'milk',
            success: false,
            failure: {
              code: ErrorCode.ValidationFailed,
              field: 'remainingNetWeight',
            },
            pantryItem: null,
          },
        ],
      },
    },
  });
  const carton = {
    ...stack('milk', 2),
    packageSize: { value: 64, unitId: 'unit-floz' },
    netWeightUnit: { id: 'unit-floz', symbol: 'fl oz' },
  };
  renderWithApollo(<StockCheckSheet visible onDismiss={jest.fn()} />, {
    operationMocks: [
      recordMock(StockToConfirmDocument, {
        data: { pantry: { id: 'P1', stockToConfirm: [carton] } },
      }).mock,
      recorded.mock,
    ],
  });
  await drainTimers();

  pick('milk', StockCheckAnswer.SomeLeft);
  fireEvent.changeText(
    screen.getByTestId(pantryTestIDs.stockCheckLeft('milk')),
    '1',
  );
  fireEvent.changeText(screen.getByDisplayValue(''), '40');
  await save();

  expect(
    screen.queryByTestId(
      kitTestIDs.inputError(pantryTestIDs.stockCheckLeft('milk')),
    ),
  ).toBeNull();
  expect(screen.getByText(t('errors.codes.validationFailed'))).toBeVisible();
});

it('refuses an amount left it cannot read on the field, and sends nothing', async () => {
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: { recordPantryStockCheck: null },
  });
  const onDismiss = jest.fn();
  renderWithApollo(<StockCheckSheet visible onDismiss={onDismiss} />, {
    operationMocks: [toCheck(stack('eggs', 4)).mock, recorded.mock],
  });
  await drainTimers();

  pick('eggs', StockCheckAnswer.SomeLeft);
  fireEvent.changeText(
    screen.getByTestId(pantryTestIDs.stockCheckLeft('eggs')),
    'a few',
  );
  await save();

  expect(screen.getByText(t('errors.invalidQuantity'))).toBeTruthy();
  expect(recorded.fired).toHaveLength(0);
  expect(onDismiss).not.toHaveBeenCalled();
});

it("shows the server's evidence, with when each stack was last confirmed", async () => {
  renderWithApollo(<StockCheckSheet visible onDismiss={jest.fn()} />, {
    operationMocks: [toCheck(stack('eggs', 4)).mock],
  });
  await drainTimers();

  expect(
    screen.getByText(new RegExp(t('pantryScreen.stockLevelLow'))),
  ).toBeTruthy();
  expect(
    screen.getByText(
      new RegExp(t('pantryScreen.stockLastConfirmed', { when: '' }).trim()),
    ),
  ).toBeTruthy();
});
