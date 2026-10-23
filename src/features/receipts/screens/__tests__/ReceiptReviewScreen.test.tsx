'use no memo';
import React from 'react';
import { userEvent } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { toastService } from '#/services/toastService';
import type { ReceiptReviewRow } from '../../hooks/useReceiptReview';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';
import { receiptsTestIDs } from '../../testIDs';
import { ReceiptReviewScreen } from '../ReceiptReviewScreen';

const mockToPantryMain = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    toPantryMain: mockToPantryMain,
    goBack: jest.fn(),
  }),
}));

let mockRows: ReceiptReviewRow[] = [];
let mockStoreOffer: { id: string; name: string } | null = null;
let mockStoreLocation: {
  address: string | null;
  storeNumber: string | null;
} | null = null;
const mockChooseStore = jest.fn();
const mockAddChosen = jest.fn<Promise<{ sent: number; held: number }>, []>();
const mockFinish = jest.fn();
jest.mock('../../hooks/useReceiptReview', () => ({
  useReceiptReview: () => ({
    rows: mockRows,
    merchant: 'giant eagle',
    store: mockStoreOffer ? null : { id: 'store-1', name: 'Giant Eagle' },
    proposedStoreName: mockStoreOffer ? 'Giant Eagle' : null,
    storeLocation: mockStoreLocation,
    storeOffer: mockStoreOffer,
    storeUnrecognized: false,
    purchasedOn: '2026-10-15',
    dayIsScanDay: false,
    setPurchasedOn: jest.fn(),
    chooseStore: mockChooseStore,
    totalsGap: null,
    matchState: 'done',
    retryMatching: jest.fn(),
    pantryName: 'Kitchen Pantry',
    pendingCount: mockRows.length,
    applying: false,
    listLoading: false,
    listIncomplete: false,
    chooseLine: jest.fn(),
    listItemNameFor: () => undefined,
    pickItem: jest.fn(),
    addChosen: mockAddChosen,
    // A new function each render, as a hook closing over the draft returns.
    finish: () => mockFinish(),
  }),
}));

const row = (overrides: Partial<ReceiptReviewRow>): ReceiptReviewRow => ({
  index: 0,
  printed: 'X',
  status: 'add',
  candidates: [],
  onList: false,
  ...overrides,
});

describe('ReceiptReviewScreen rows', () => {
  it('shows what a coupon took off beside the price paid', () => {
    mockRows = [
      row({
        printed: 'MAYONNAISE AC',
        price: 6.49,
        discount: 1,
        choice: lineChoice({ itemName: 'Mayonnaise', price: 6.49 }),
      }),
    ];
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(screen.getByText('$6.49')).toBeTruthy();
    expect(screen.getByText('$1.00 off')).toBeTruthy();
  });

  it('shows a line its discount made free as free', () => {
    mockRows = [
      row({
        printed: 'BOGO CHIPS',
        price: 0,
        discount: 3.99,
        choice: lineChoice({ itemName: 'Chips', price: 0 }),
      }),
    ];
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('$3.99 off')).toBeTruthy();
  });

  it('says a line is not for the pantry', () => {
    mockRows = [
      row({
        printed: 'PAPER TOWELS',
        price: 5.99,
        choice: lineChoice({
          itemName: 'Paper towels',
          price: 5.99,
          notStocked: true,
        }),
      }),
    ];
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(
      screen.getByText(/PAPER TOWELS · 1 · not for the pantry/),
    ).toBeTruthy();
  });
});

describe('ReceiptReviewScreen Add', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRows = [
      row({ printed: 'MILK', choice: lineChoice({ price: 2.79 }) }),
      row({ index: 1, printed: 'BREAD', choice: lineChoice({ price: 1.99 }) }),
    ];
  });

  it('goes to the pantry as soon as the lines are shown there, without waiting on the API', async () => {
    mockAddChosen.mockResolvedValue({ sent: 2, held: 0 });
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    await userEvent
      .setup()
      .press(screen.getByTestId(receiptsTestIDs.reviewAdd));

    expect(toastService.success).toHaveBeenCalledWith(
      'Added 2 items to Kitchen Pantry',
    );
    expect(mockToPantryMain).toHaveBeenCalledTimes(1);
  });

  it('leaves the receipt once, when the review is gone, however often it changes while open', async () => {
    mockAddChosen.mockResolvedValue({ sent: 2, held: 0 });
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    await userEvent
      .setup()
      .press(screen.getByTestId(receiptsTestIDs.reviewAdd));
    // The check-in settling, then queueing, re-renders the closing review.
    screen.rerender(<ReceiptReviewScreen />);
    screen.rerender(<ReceiptReviewScreen />);

    expect(mockFinish).not.toHaveBeenCalled();
    screen.unmount();
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('stays on the review while a line still lacks something', async () => {
    mockAddChosen.mockResolvedValue({ sent: 1, held: 1 });
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    await userEvent
      .setup()
      .press(screen.getByTestId(receiptsTestIDs.reviewAdd));

    expect(toastService.success).toHaveBeenCalledTimes(1);
    expect(mockToPantryMain).not.toHaveBeenCalled();
  });
});

describe('ReceiptReviewScreen store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRows = [row({ printed: 'MILK', choice: lineChoice({ price: 2.79 }) })];
  });
  afterEach(() => {
    mockStoreOffer = null;
    mockStoreLocation = null;
  });

  it('says which branch of the chain it is, and opens the store field from it', async () => {
    mockStoreLocation = {
      address: '100 Main St, Springfield',
      storeNumber: '42',
    };
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    const where = screen.getByTestId(receiptsTestIDs.reviewStoreWhere);
    expect(where).toHaveTextContent('100 Main St, Springfield');
    // A caption-height line: the slop makes it a full-size target.
    expect(where).toHaveProp('hitSlop', 12);
    expect(where).toHaveProp('accessibilityHint', 'Changes the store');
    expect(screen.queryByTestId(receiptsTestIDs.reviewStore)).toBeNull();

    await userEvent.setup().press(where);

    expect(screen.getByTestId(receiptsTestIDs.reviewStore)).toBeTruthy();
  });

  it('names the branch by its number when no address is on file', () => {
    mockStoreLocation = { address: null, storeNumber: '42' };
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(
      screen.getByTestId(receiptsTestIDs.reviewStoreWhere),
    ).toHaveTextContent('Store #42');
  });

  it('says nothing of where the store is when nothing is known', () => {
    mockStoreLocation = { address: null, storeNumber: null };
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(screen.queryByTestId(receiptsTestIDs.reviewStoreWhere)).toBeNull();
  });

  it("offers the unlocated store, saying it takes the receipt's address, and picks it on a tap", async () => {
    mockStoreOffer = { id: 'store-label', name: 'Giant Eagle (home)' };
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    const offer = screen.getByTestId(receiptsTestIDs.reviewStoreOffer);
    expect(offer).toHaveTextContent(/Giant Eagle \(home\)/);
    expect(offer).toHaveTextContent(/Adds this receipt's address/);
    expect(mockChooseStore).not.toHaveBeenCalled();

    await userEvent.setup().press(screen.getByText('Giant Eagle (home)'));

    expect(mockChooseStore).toHaveBeenCalledWith({
      id: 'store-label',
      name: 'Giant Eagle (home)',
    });
  });

  it('offers no store when there is none to complete', () => {
    const screen = renderWithApollo(<ReceiptReviewScreen />);

    expect(screen.queryByTestId(receiptsTestIDs.reviewStoreOffer)).toBeNull();
    expect(screen.queryByText("Adds this receipt's address")).toBeNull();
  });
});
