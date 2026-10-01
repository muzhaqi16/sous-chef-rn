import { redactReceiptText } from '../redactReceiptText';

// Formats as each chain prints them; the scanned corpus is held to the same
// deny-list in receiptCorpus.test.ts.
const redactOne = (lines: string[]) => redactReceiptText([lines])[0];

describe('redactReceiptText', () => {
  it('sends neither the card digits nor the authorisation code (spec scenario)', () => {
    const kept = redactOne([
      'MILK  3.48',
      'VISA ************4242',
      'AUTH CODE 123456',
    ]);

    expect(kept).toEqual(['MILK  3.48']);
    expect(kept?.join('\n')).not.toMatch(/4242|123456/);
  });

  it('Walmart: keeps the header, items and totals; cuts after CHANGE DUE', () => {
    expect(
      redactOne([
        'WALMART SUPERCENTER',
        'STORE #1234 (555) 555-1234',
        'ST# 01234 OP# 009012 TE# 12 TR# 01234',
        'GV WHOLE MILK 007874235186 F  3.48 N',
        'BANANAS 000000004011 KF  1.24 N',
        'SUBTOTAL  4.72',
        'TAX 1 6.000 %  0.00',
        'TOTAL  4.72',
        'VISA TEND  4.72',
        'ACCOUNT # **** **** **** 4242 S',
        'APPROVAL # 01234K',
        'REF # 123456789012',
        'TRANS ID - 123456789012345',
        'AID A0000000031010',
        'AAC 1234ABCD5678EF90',
        'TERMINAL # SC010123',
        'CHANGE DUE  0.00',
        '# ITEMS SOLD 2',
        'TC# 0123 4567 8901 2345 6789',
      ]),
    ).toEqual([
      'WALMART SUPERCENTER',
      'STORE #1234 (555) 555-1234',
      'ST# 01234 OP# 009012 TE# 12 TR# 01234',
      'GV WHOLE MILK 007874235186 F  3.48 N',
      'BANANAS 000000004011 KF  1.24 N',
      'SUBTOTAL  4.72',
      'TAX 1 6.000 %  0.00',
      'TOTAL  4.72',
      'VISA TEND  4.72',
      'CHANGE DUE  0.00',
    ]);
  });

  it('Kroger: the BALANCE line ends the receipt, and the loyalty card goes', () => {
    expect(
      redactOne([
        'KROGER',
        'KROGER PLUS CUSTOMER ************1234',
        '0001111041700 KRO WHL MILK  3.29 F',
        'SC KROGER SAVINGS  0.50-',
        'TAX  0.00',
        '**** BALANCE  2.79',
        'Ref: 123456 Auth: 012345',
        'VISA CREDIT  2.79',
        'TOTAL SAVINGS  0.50',
      ]),
    ).toEqual([
      'KROGER',
      '0001111041700 KRO WHL MILK  3.29 F',
      'SC KROGER SAVINGS  0.50-',
      'TAX  0.00',
      '**** BALANCE  2.79',
    ]);
  });

  it('Target: a one-star mask with the last four digits goes', () => {
    expect(
      redactOne([
        'TARGET',
        '071010203 GG MILK NF  3.19',
        'SUBTOTAL  3.19',
        'TOTAL  3.19',
        '*4242 DEBIT CARD PURCHASE  $3.19',
        'AUTH CODE: 012345',
      ]),
    ).toEqual([
      'TARGET',
      '071010203 GG MILK NF  3.19',
      'SUBTOTAL  3.19',
      'TOTAL  3.19',
    ]);
  });

  it('Costco: the chip line, AID, sequence, approval and transaction ids go', () => {
    expect(
      redactOne([
        'COSTCO WHOLESALE',
        'E 1234567 KS WATER 40PK  4.99 A',
        'SUBTOTAL  4.99',
        '**** TOTAL  4.99',
        'XXXXXXXXXXXX1234 CHIP',
        'AID: A0000000031010',
        'Seq#: 12345',
        'App#: 012345',
        'Tran ID#: 123456789012',
        'Resp: APPROVED',
        'VISA  4.99',
        'CHANGE  0.00',
        'Member 111222333444',
      ]),
    ).toEqual([
      'COSTCO WHOLESALE',
      'E 1234567 KS WATER 40PK  4.99 A',
      'SUBTOTAL  4.99',
      '**** TOTAL  4.99',
      'Resp: APPROVED',
      'VISA  4.99',
      'CHANGE  0.00',
    ]);
  });

  it('Safeway: a club card number goes, the club savings stay', () => {
    expect(
      redactOne([
        'SAFEWAY',
        'CLUB CARD # 1234567890',
        'LUCERNE MILK  3.99',
        'CLUB CARD SAVINGS  1.50-',
        'MEMBER # 9876543210',
      ]),
    ).toEqual(['SAFEWAY', 'LUCERNE MILK  3.99', 'CLUB CARD SAVINGS  1.50-']);
  });

  // Shapes from the scanned corpus (__tests__/fixtures/receipts/corpus), with
  // made-up digits.
  it('ALDI US: a reference after the date and the chip record continuation go', () => {
    expect(
      redactReceiptText([
        [
          'Celery  1.65  FA',
          'VISA  16.19',
          '***************4242 OTHER',
          '09/30/26 09:51 Ref/Seq # 123456',
          'Trace # 123456',
          'Auth # 012345',
          'AID A0000000031010',
          'IAD 0F1E2D3C4B5A69788796A5B4C3D2E1F00',
          '00112233445566778899AABBCCDDEEFF',
          'TSI 0000    ARC 000    EntryMode 07',
          '++APPROVED++',
        ],
      ]),
    ).toEqual([['Celery  1.65  FA', 'VISA  16.19']]);
  });

  it('ALDI UK: the British spelling and a partly masked merchant id go', () => {
    expect(
      redactReceiptText([
        [
          'Total  29.78',
          'Merchant ID: **12345',
          'Terminal ID: ****1234',
          'EFT No: 1234',
          'Authorisation Code: 654321',
          'AID: A0000000041010',
          'Please keep this receipt for your records',
        ],
      ]),
    ).toEqual([['Total  29.78', 'Please keep this receipt for your records']]);
  });

  it('Giant Eagle: a split tender with the card network and last four goes', () => {
    expect(
      redactOne([
        'TAX  0.49',
        'MC 4242  4.49',
        'MC 4242 Tax  0.49-',
        'VISA  12.50',
        'VISA 1234.56',
      ]),
    ).toEqual(['TAX  0.49', 'VISA  12.50', 'VISA 1234.56']);
  });

  it("Trader Joe's: a labelled chip cryptogram goes", () => {
    expect(
      redactOne(['AVOCADO HASS EACH  5.97', 'C: 0123456789ABCDEF']),
    ).toEqual(['AVOCADO HASS EACH  5.97']);
  });

  it('cuts at a balance whose last digit recognition dropped', () => {
    expect(redactOne(['**** BALANCE  154.7', 'MC 4242  95.39'])).toEqual([
      '**** BALANCE  154.7',
    ]);
  });

  it('cuts at a change line recognition read margin noise before', () => {
    expect(redactOne(['801  CHANGE DUE  0.00', 'TERAINAC 1 X612326'])).toEqual([
      '801  CHANGE DUE  0.00',
    ]);
  });

  it('removes a full card number, grouped or not', () => {
    expect(
      redactOne([
        '4111 1111 1111 1111',
        '4111-1111-1111-1111',
        '4111111111111111',
      ]),
    ).toEqual([]);
  });

  it('keeps items that only look like payment labels, and item codes up to 14 digits', () => {
    const items = [
      'AIDELLS CHKN SAUSAGE  5.99',
      'TRACE MINERALS DROPS  9.99',
      'REFRIED BEANS  1.29',
      'APPLE JUICE 64OZ  3.49',
      'MIDWEST CHEESE  2.99',
      'GIFT CARD  25.00',
      'SODA 12PK  *12.99',
      '00012345678905 CASE WATER  5.99',
    ];

    expect(redactOne(items)).toEqual(items);
  });

  it('does not cut at a BALANCE with no amount, such as a rewards header', () => {
    expect(redactOne(['BALANCE REWARDS', 'MILK  3.48'])).toEqual([
      'BALANCE REWARDS',
      'MILK  3.48',
    ]);
  });

  it('cuts across pages: nothing after the payment block survives', () => {
    expect(
      redactReceiptText([
        ['MILK  3.48'],
        ['TOTAL  3.48', 'CHANGE DUE  0.00', 'SURVEY 1234'],
        ['VISA ************4242', 'THANK YOU'],
      ]),
    ).toEqual([['MILK  3.48'], ['TOTAL  3.48', 'CHANGE DUE  0.00'], []]);
  });
});
