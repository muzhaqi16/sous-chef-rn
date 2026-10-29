'use no memo';

import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { ReceiptDraft } from '../../store/receiptDraftStore';
import type { ReceiptScanStatus } from '../useReceiptScan';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';
import { receiptsTestIDs } from '../../testIDs';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { ReceiptScanScreen } from '../ReceiptScanScreen';
import { ReceiptFlowExitsProvider } from '../receiptFlowExits';
import { kitTestIDs } from '#components/testIDs';

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: jest.fn(), toReceiptReview: jest.fn() }),
}));

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

let mockScan: { status: ReceiptScanStatus; draft: ReceiptDraft | null };
jest.mock('../useReceiptScan', () => ({
  useReceiptScan: () => ({
    ...mockScan,
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

const NOT_READING = { readingStatus: 'none', slowPhotoRead: false };

// What the saved screen says left the phone, by the draft, the server's
// reading and whether the server reads receipts, and what it shows beside it.
const SAVED: [
  string,
  Partial<ReceiptDraft>,
  typeof NOT_READING,
  boolean,
  string,
  string[],
][] = [
  [
    'says a photo went as it was, and that photos take a while',
    { photoKeys: ['k1'] },
    { readingStatus: 'reading', slowPhotoRead: true },
    true,
    "Your phone couldn't read this receipt on its own, so its photo was sent to be read as it is. The photo is deleted once read.",
    ['Reading the photos can take up to a minute…'],
  ],
  [
    'says a masked photo went with the personal details covered',
    { photoKeys: ['k1'], photosMasked: true },
    NOT_READING,
    true,
    "Your phone couldn't read this receipt on its own, so its photo was sent to be read, with card numbers, member numbers and names covered. The photo is deleted once read.",
    [],
  ],
  [
    'says the text of a receipt the phone could not read is sent to be read',
    {},
    { readingStatus: 'reading', slowPhotoRead: false },
    true,
    "Your phone couldn't read this receipt on its own, so its text is sent to be read, without card and loyalty numbers.",
    ['Picking out the items…'],
  ],
  [
    'says only the text is kept where the server reads no receipts',
    {},
    NOT_READING,
    false,
    "Only the receipt's text is kept, with card and loyalty numbers removed.",
    [],
  ],
  [
    'says a receipt read on the phone sent nothing',
    {
      parsedBy: 'device',
      parsed: {
        lines: [
          {
            index: 0,
            rawText: 'MILK 3.48',
            kind: 'item',
            product: 'MILK',
            lineTotal: 3.48,
          },
        ],
      },
    },
    NOT_READING,
    true,
    "Read on your phone, so nothing was sent. Card and loyalty numbers are removed from what's kept.",
    ['Review 1 item'],
  ],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockReading = { readingStatus: 'none', slowPhotoRead: false };
  jest.mocked(useFeatureFlag).mockReturnValue(true);
});

describe('ReceiptScanScreen', () => {
  it.each([
    ['a code', ErrorCode.ValidationFailed],
    ['no code this build knows', null],
  ])(
    'names the lines the API refused with %s, to fix in the review and add again',
    (_case, code) => {
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
          failed: { 1: code },
        },
      };
      const screen = renderWithApollo(<ReceiptScanScreen />);

      expect(screen.getByText("1 line wasn't added")).toBeTruthy();
      expect(
        screen.getByText(/^Cubanelle pepper\. Open the review/),
      ).toBeTruthy();
      expect(screen.getByTestId(receiptsTestIDs.savedReview)).toBeTruthy();
      expect(screen.queryByTestId(receiptsTestIDs.savedQueued)).toBeNull();
    },
  );

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

  // The scanner presents over the app, never over the confirmation's modal.
  it('opens the scanner for a replacement only once the confirmation has closed', () => {
    mockScan = {
      status: 'saved',
      draft: { pages: ['MILK 3.48'], scannedAt: SCANNED_AT },
    };
    const screen = renderWithApollo(<ReceiptScanScreen />);

    fireEvent.press(screen.getByText('Scan another receipt'));

    const [call] = jest.mocked(alertService.alert).mock.calls;
    const replace = call?.[2]?.find(button => button.text === 'Replace');
    expect(replace?.afterClose).toBe(true);
  });

  it.each(SAVED)(
    '%s',
    (_name, draft, reading, serverParsing, body, alsoShown) => {
      jest
        .mocked(useFeatureFlag)
        .mockImplementation(flag => serverParsing || flag !== 'receiptParsing');
      mockScan = {
        status: 'saved',
        draft: { pages: ['MILK 3.48'], scannedAt: SCANNED_AT, ...draft },
      };
      mockReading = reading;
      const screen = renderWithApollo(<ReceiptScanScreen />);

      const bodies = SAVED.map(row => row[4]);
      expect(bodies.filter(text => screen.queryByText(text))).toEqual([body]);
      for (const text of alsoShown) expect(screen.getByText(text)).toBeTruthy();
    },
  );
});

describe('ReceiptScanScreen under a borrowing flow', () => {
  it('closes through the flow’s exit, not the receipts stack', () => {
    const exits = {
      toReview: jest.fn(),
      close: jest.fn(),
      added: jest.fn(),
      finished: jest.fn(),
    };
    const screen = renderWithApollo(
      <ReceiptFlowExitsProvider actions={exits}>
        <ReceiptScanScreen />
      </ReceiptFlowExitsProvider>,
    );

    fireEvent.press(screen.getByTestId(kitTestIDs.headerCloseButton));

    expect(exits.close).toHaveBeenCalledTimes(1);
  });
});
