import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
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
jest.mock('#components/templates/Sheet', () => {
  const { View } = require('react-native');
  return {
    Sheet: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

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
