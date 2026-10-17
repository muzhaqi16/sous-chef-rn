import { redactReceiptText } from '../redactReceiptText';

// Formats as each chain prints them.
const redactOne = (lines: string[]) => redactReceiptText([lines])[0];

describe('redactReceiptText', () => {
  it.each<[string, string[], string[]]>([
    [
      'sends neither the card digits nor the authorisation code (spec scenario)',
      ['MILK  3.48', 'VISA ************4242', 'AUTH CODE 123456'],
      ['MILK  3.48'],
    ],
    [
      'Walmart: keeps the header, items and totals; cuts after CHANGE DUE',
      [
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
      ],
      [
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
      ],
    ],
    [
      'Kroger: the BALANCE line ends the receipt, and the loyalty card goes',
      [
        'KROGER',
        'KROGER PLUS CUSTOMER ************1234',
        '0001111041700 KRO WHL MILK  3.29 F',
        'SC KROGER SAVINGS  0.50-',
        'TAX  0.00',
        '**** BALANCE  2.79',
        'Ref: 123456 Auth: 012345',
        'VISA CREDIT  2.79',
        'TOTAL SAVINGS  0.50',
      ],
      [
        'KROGER',
        '0001111041700 KRO WHL MILK  3.29 F',
        'SC KROGER SAVINGS  0.50-',
        'TAX  0.00',
        '**** BALANCE  2.79',
      ],
    ],
    [
      'Target: a one-star mask with the last four digits goes',
      [
        'TARGET',
        '071010203 GG MILK NF  3.19',
        'SUBTOTAL  3.19',
        'TOTAL  3.19',
        '*4242 DEBIT CARD PURCHASE  $3.19',
        'AUTH CODE: 012345',
      ],
      ['TARGET', '071010203 GG MILK NF  3.19', 'SUBTOTAL  3.19', 'TOTAL  3.19'],
    ],
    [
      'Costco: the chip line, AID, sequence, approval and transaction ids go',
      [
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
      ],
      [
        'COSTCO WHOLESALE',
        'E 1234567 KS WATER 40PK  4.99 A',
        'SUBTOTAL  4.99',
        '**** TOTAL  4.99',
        'Resp: APPROVED',
        'VISA  4.99',
        'CHANGE  0.00',
      ],
    ],
    [
      'Costco: a member number recognition broke with a bar or misspelled goes from the header',
      [
        'COSTCO WHOLESALE',
        'Leesburg #123',
        '9Q Member 123| 456',
        'Member 1l2I 345!678',
        '04 Menber 111222333444',
        'Mernber 111222333444',
        '540003 FIRE EXT.  39.99 A',
      ],
      ['COSTCO WHOLESALE', 'Leesburg #123', '540003 FIRE EXT.  39.99 A'],
    ],
    [
      'Safeway: a club card number goes, the club savings stay',
      [
        'SAFEWAY',
        'CLUB CARD # 1234567890',
        'LUCERNE MILK  3.99',
        'CLUB CARD SAVINGS  1.50-',
        'MEMBER # 9876543210',
      ],
      ['SAFEWAY', 'LUCERNE MILK  3.99', 'CLUB CARD SAVINGS  1.50-'],
    ],
    // Shapes from scanned receipts, with made-up digits.
    [
      'ALDI US: a reference after the date and the chip record continuation go',
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
      ['Celery  1.65  FA', 'VISA  16.19'],
    ],
    [
      'ALDI US: a reference goes when recognition reads its Seq as Seg',
      ['Celery  1.65  FA', '09/30/26 09:51 Ref/Seg # 123456'],
      ['Celery  1.65  FA'],
    ],
    [
      'ALDI UK: the British spelling and a partly masked merchant id go',
      [
        'Total  29.78',
        'Merchant ID: **12345',
        'Terminal ID: ****1234',
        'EFT No: 1234',
        'Authorisation Code: 654321',
        'AID: A0000000041010',
        'Please keep this receipt for your records',
      ],
      ['Total  29.78', 'Please keep this receipt for your records'],
    ],
    [
      'Giant Eagle: a split tender with the card network and last four goes',
      [
        'TAX  0.49',
        'MC 4242  4.49',
        'MC 4242 Tax  0.49-',
        'VISA  12.50',
        'VISA 1234.56',
      ],
      ['TAX  0.49', 'VISA  12.50', 'VISA 1234.56'],
    ],
    [
      'Giant Eagle: the name of the staff member who helped is masked',
      ['#1619 EDGEWOOD', 'Helped by GEORGETTE N', 'POTATO SLD  8.99 F'],
      ['#1619 EDGEWOOD', 'Helped by [name]', 'POTATO SLD  8.99 F'],
    ],
    [
      "masks an email and a customer's phone, and keeps the store's phone and a count's price",
      [
        'SAMPLE MART  (412) 555-0100',
        'Receipts to pat@example.com',
        'WHOLE MILK  3.48',
        '2@4.99',
        'Callback 412-555-0199',
      ],
      [
        'SAMPLE MART  (412) 555-0100',
        'Receipts to [email]',
        'WHOLE MILK  3.48',
        '2@4.99',
        'Callback [phone]',
      ],
    ],
    [
      'Walmart: the manager printed after the phone number is masked',
      ['4125550100 Mgr. PAT', 'BANANAS 000000004011 KF  1.24 N'],
      ['4125550100 Mgr. [name]', 'BANANAS 000000004011 KF  1.24 N'],
    ],
    [
      "East End co-op: the member's name goes, and nothing after a change read apart from its amount",
      [
        'Inv#:00123456 Trs#:654321',
        'DOE, JANE',
        'Goat Cheese - Honey 4 oz  $4.69 F',
        'TOTAL SALES  $4.69',
        'Visa',
        '$0.00',
        'Change',
        'NETWORK.ID:VISA',
        'SEQUENCE #: 123456',
        'AUTHOR #: 654321',
      ],
      [
        'Inv#:00123456 Trs#:654321',
        '[name]',
        'Goat Cheese - Honey 4 oz  $4.69 F',
        'TOTAL SALES  $4.69',
        'Visa',
        '$0.00',
        'Change',
      ],
    ],
    [
      'drops a spelled-out sequence number and a shortened authorisation label anywhere',
      ['MILK  3.48', 'SEQUENCE #: 123456', 'AUTHOR #: 654321'],
      ['MILK  3.48'],
    ],
    [
      'keeps a bare balance, which some tills print as the total, a town and its state, and a priced item',
      [
        'CAMERON, MO',
        'PEPPERS, GREEN  1.99',
        '**** BALANCE',
        '18.76',
        'Org Pinto/Kid Bean  0.99  FA',
      ],
      [
        'CAMERON, MO',
        'PEPPERS, GREEN  1.99',
        '**** BALANCE',
        '18.76',
        'Org Pinto/Kid Bean  0.99  FA',
      ],
    ],
    [
      'keeps an item that only starts like a staff label',
      ['TEAM MEMBER', 'SERVER 4.99'],
      ['TEAM MEMBER', 'SERVER 4.99'],
    ],
    // The duplicate receipt prints dots for spaces.
    [
      'Giant Eagle duplicate: dotted payment rows go, a dotted name is masked',
      [
        '........COTTAGE.CHSE...........4.79.F',
        '.....Cashier:.PAT.................',
        '***.REF.#.51833069687....H........',
        'AID:.A0000000031010...............',
        'TERMINAL:.393.....................',
        '...****.BALANCE...............28.32..',
        'DATE:.10/15/26..TIME:.04:18pm',
      ],
      [
        '........COTTAGE.CHSE...........4.79.F',
        '.....Cashier:.[name]',
        '...****.BALANCE...............28.32..',
      ],
    ],
    [
      "Trader Joe's: a labelled chip cryptogram goes",
      ['AVOCADO HASS EACH  5.97', 'C: 0123456789ABCDEF'],
      ['AVOCADO HASS EACH  5.97'],
    ],
    [
      'cuts at a balance whose last digit recognition dropped',
      ['**** BALANCE  154.7', 'MC 4242  95.39'],
      ['**** BALANCE  154.7'],
    ],
    [
      'cuts at a change line recognition read margin noise before',
      ['801  CHANGE DUE  0.00', 'TERAINAC 1 X612326'],
      ['801  CHANGE DUE  0.00'],
    ],
    [
      'removes a full card number, grouped or not',
      [
        '4111 1111 1111 1111',
        '4111-1111-1111-1111',
        '4111111111111111',
        '4111 1111 1111 1111 7.49',
      ],
      [],
    ],
    [
      'removes an Amex number in its 4-6-5 groups',
      ['3782 822463 10005', '3782-822463-10005', '378282246310005'],
      [],
    ],
    [
      'does not cut at a BALANCE with no amount, such as a rewards header',
      ['BALANCE REWARDS', 'MILK  3.48'],
      ['BALANCE REWARDS', 'MILK  3.48'],
    ],
  ])('%s', (_name, lines, kept) => {
    expect(redactOne(lines)).toEqual(kept);
  });

  it('Giant Eagle: a cashier is masked when recognition misspells the words around them', () => {
    expect(
      redactOne(['6493 Strip Ave. N', 'Yaur Cashier Todey was Sam K']),
    ).toEqual(['6493 Strip Ave. N', 'Yaur Cashier Todey was [name]']);
    expect(redactOne(['Yaur Cashier Today vas Sam K'])).toEqual([
      'Yaur Cashier Today vas [name]',
    ]);
  });

  it('keeps items that only look like payment labels or card numbers, and item codes up to 14 digits', () => {
    const items = [
      'AIDELLS CHKN SAUSAGE  5.99',
      'TRACE MINERALS DROPS  9.99',
      'REFRIED BEANS  1.29',
      'APPLE JUICE 64OZ  3.49',
      'MIDWEST CHEESE  2.99',
      'GIFT CARD  25.00',
      'SODA 12PK  *12.99',
      '00012345678905 CASE WATER  5.99',
      // A code beside a short number, and card-shaped digits that fail Luhn.
      '041220576054 1234 PEANUT BTR  3.49',
      '00012345678905 12 BANANAS  1.24',
      '4111 1111-1111 1111 MIXED NUTS  4.99',
      '1234 5678 9012 3456 GIFT BAG  1.00',
    ];

    expect(redactOne(items)).toEqual(items);
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
