'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { ReceiptDraft } from '../../store/receiptDraftStore';
import type { ReceiptScanStatus } from '../../hooks/useReceiptScan';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';
import { receiptsTestIDs } from '../../testIDs';
import { ReceiptScanScreen } from '../ReceiptScanScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: jest.fn(), toReceiptReview: jest.fn() }),
}));

const mockAnswerConsent = jest.fn();
let mockScan: { status: ReceiptScanStatus; draft: ReceiptDraft | null };
jest.mock('../../hooks/useReceiptScan', () => ({
  useReceiptScan: () => ({
    ...mockScan,
    answerConsent: mockAnswerConsent,
    pickedFromLibrary: false,
    canSendPhotos: true,
    scan: jest.fn(),
    takePhoto: jest.fn(),
    pickPhoto: jest.fn(),
    sendPhotos: jest.fn(),
    declinePhotos: jest.fn(),
    discard: jest.fn(),
  }),
}));

let mockReading = { readingStatus: 'none', slowPhotoRead: false };
jest.mock('../../hooks/useServerReceiptParse', () => ({
  useServerReceiptParse: () => ({ ...mockReading, retryAt: undefined }),
}));

const SCANNED_AT = '2026-10-07T10:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  mockReading = { readingStatus: 'none', slowPhotoRead: false };
});

describe('ReceiptScanScreen', () => {
  it('asks whether photos may be sent, and passes the answer on', async () => {
    mockScan = { status: 'consent', draft: null };
    const screen = renderWithApollo(<ReceiptScanScreen />);
    const user = userEvent.setup();

    expect(screen.getByText('Read receipts from their photos?')).toBeTruthy();
    expect(screen.getByText(/the server sees the whole receipt/)).toBeTruthy();

    await user.press(screen.getByText('Send photos'));
    expect(mockAnswerConsent).toHaveBeenLastCalledWith('granted');
    await user.press(screen.getByText('Use text only'));
    expect(mockAnswerConsent).toHaveBeenLastCalledWith('declined');
  });

  it('says a receipt read from its photos keeps only its text, and that photos take a while', () => {
    mockScan = {
      status: 'saved',
      draft: { pages: ['MILK 3.48'], photoKeys: ['k1'], scannedAt: SCANNED_AT },
    };
    mockReading = { readingStatus: 'reading', slowPhotoRead: true };
    const screen = renderWithApollo(<ReceiptScanScreen />);

    expect(
      screen.getByText(/The photo was sent to be read and is deleted/),
    ).toBeTruthy();
    expect(
      screen.getByText('Reading the photos can take up to a minute…'),
    ).toBeTruthy();
  });

  it('names the lines the API refused, to fix in the review and add again', () => {
    mockScan = {
      status: 'saved',
      draft: {
        pages: ['MILK 3.48'],
        scannedAt: SCANNED_AT,
        parsed: {
          lines: [
            { index: 0, rawText: 'MILK 3.48', kind: 'item', product: 'MILK' },
            {
              index: 1,
              rawText: 'CUBANELLE 1.20',
              kind: 'item',
              product: 'CUBANELLE',
            },
          ],
        },
        choices: {
          1: lineChoice({ itemId: null, itemName: 'Cubanelle pepper' }),
        },
        added: [0],
        failed: { 1: ErrorCode.ValidationFailed },
      },
    };
    const screen = renderWithApollo(<ReceiptScanScreen />);

    expect(screen.getByText("1 line wasn't added")).toBeTruthy();
    expect(
      screen.getByText(/^Cubanelle pepper\. Open the review/),
    ).toBeTruthy();
    expect(screen.getByTestId(receiptsTestIDs.savedReview)).toBeTruthy();
    expect(screen.queryByTestId(receiptsTestIDs.savedQueued)).toBeNull();
  });

  it('says a check-in waiting for a connection lands once the phone is back online', () => {
    mockScan = {
      status: 'saved',
      draft: {
        pages: ['MILK 3.48'],
        scannedAt: SCANNED_AT,
        added: [0],
        checkIn: { ids: ['c1'], lines: {}, state: 'queued', closed: true },
      },
    };
    const screen = renderWithApollo(<ReceiptScanScreen />);

    expect(screen.getByText("Adding when you're back online")).toBeTruthy();
    expect(screen.queryByTestId(receiptsTestIDs.savedFailed)).toBeNull();
  });

  it('says a receipt read from its text keeps only its text', () => {
    mockScan = {
      status: 'saved',
      draft: { pages: ['MILK 3.48'], scannedAt: SCANNED_AT },
    };
    mockReading = { readingStatus: 'reading', slowPhotoRead: false };
    const screen = renderWithApollo(<ReceiptScanScreen />);

    expect(
      screen.getByText(
        "Only the receipt's text is kept, with card and loyalty numbers removed.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('Picking out the items…')).toBeTruthy();
  });
});
