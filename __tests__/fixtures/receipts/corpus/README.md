# Receipt evaluation corpus

Photographed receipts as the app reads them: the text recognised on device,
reassembled into printed rows, with payment and loyalty details redacted, and
the labels Apple's on-device model gave the lines the app sends it. No images
are kept. This is the `receipt-scanning` change's corpus (tasks 1.2, design
§ D8).

- `receiptCorpus.test.ts` (in `src/features/receipts/utils/__tests__/`) holds
  every file to the redaction: no deny-list rule may drop a line kept here, and
  no payment field or card tail may survive, checked by a second pattern worded
  apart from the deny-list.
- The parser metrics are a measurement, not a gate. Run them before and after
  a parser change, and put both in the PR:

  ```
  node scripts/receipt-corpus/measure.mjs
  ```

  They score the stored labels without the model: per receipt, whether it is
  usable, items found, items priced, and whether the items add up to the
  printed subtotal. No receipt is hand-labelled, so "adds up" is the proxy for
  every item found and priced.

## Building

```
node scripts/receipt-corpus/build.mjs
```

This needs macOS 26 or later with Apple Intelligence on. The script:

1. downloads each photo in `scripts/receipt-corpus/sources.json` from
   Wikimedia Commons into the system temp dir;
2. reads it with the app's Vision settings (`ocr.swift`);
3. assembles, dates and redacts it with the app's own utils;
4. labels what `parseReceiptOnDevice` would send (`label.swift`);
5. writes one JSON file per receipt here.

A private set (sources with `"path"` in place of `"file"`) builds and measures
the same way:

```
node scripts/receipt-corpus/build.mjs private-sources.json /some/dir/outside/the/repo
node scripts/receipt-corpus/measure.mjs /some/dir/outside/the/repo
```

Keep a private set out of this repository. It is public.

## File shape

```
{
  id, group,                     // group: grocery | retail
  source: { page, license, author },
  printedOn,                     // the day the receipt prints, or null
  pages: [string],               // redacted rows, one string per page
  onDevice: {
    model, seconds,              // the model and how long labelling took
    storeName?, error?,          // error: the model refused or failed
    lines: [{ line, label, product? }]
  }
}
```

`onDevice.lines` covers only the lines through the first printed total
(`linesThroughTotal`), as the app sends them.

## Sources and licences

Every file is a transcription of a Wikimedia Commons photo and carries that
photo's licence. The link and author are in its `source` field.

| Receipt | Author | Licence |
| --- | --- | --- |
| Walmart, 2021-09-11 | Cryptogoth | CC BY-SA 4.0 |
| Walmart, 2021-09-08 | Cryptogoth | CC BY-SA 4.0 |
| Walmart, 2021-07-25 (OSE Apprenticeship) | Cryptogoth | CC BY-SA 4.0 |
| Trader Joe's, 2021-09-12 | Cryptogoth | CC BY-SA 4.0 |
| Target, 2018-05-12 | 123TheBusHonolulu696969 | CC BY-SA 4.0 |
| 99 Cents Only, 2021 | Downtowngal | CC BY-SA 4.0 |
| Family Dollar | Corn cheese | CC BY-SA 3.0 |
| Columbia Sportswear, Portland, 1989 | Mateus2019 | CC BY-SA 4.0 |
| Mid-Columbia Pools, Hood River, 1990 | Mateus2019 | CC BY-SA 4.0 |
| Smith's Food and Drug, 2012-01-02 | Amin Eshaiker | Public domain |
| Save Mart, 2010-10-23 | Amin Eshaiker | Public domain |
| Circle K, 2005-07-22 | Amin Eshaiker | Public domain |
| Love's, Coachella, 2011-12-31 | Amin Eshaiker | Public domain |
| Fanzz, Westminster Mall, 2002-12-26 | Amin Eshaiker | Public domain |
| Shiekh Shoes, Westminster Mall, 2002-06-19 | Amin Eshaiker | Public domain |
| Wherehouse, 2006-04-12 | Amin Eshaiker | Public domain |
| Cline's Hallmark, 2010-11-20 | Amin Eshaiker | Public domain |

## Known limits

- **Too small for D8.** D8 asks for 30–50 receipts across Walmart, the Kroger
  family, Costco, Target, Aldi, Publix, Albertsons/Safeway, H-E-B, Trader Joe's
  and Whole Foods. Commons has none from Costco, Publix, Safeway, H-E-B or
  Whole Foods.
- **Faded labels survive redaction.** On the Circle K print, recognition reads
  `Auth#` as `Th8` and `Ref#` as `521`, so their values stay. The photo is
  public, and its uploader blacked out the card number.
