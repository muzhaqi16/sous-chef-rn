/**
 * A unit or reading as the documents select it, labelled as an abbreviation
 * reads in every language: its short form is its symbol, singular and plural.
 * A test of a localized or plural label states those fields itself.
 */
export const asAbbreviation = <const T extends { symbol: string }>(
  unit: T,
): T & { localizedSymbol: T['symbol']; symbolOther: T['symbol'] } => ({
  ...unit,
  localizedSymbol: unit.symbol,
  symbolOther: unit.symbol,
});

export const readingAsAbbreviation = <const T extends { symbol: string }>(
  reading: T,
): T & { localizedSymbol: T['symbol'] } => ({
  ...reading,
  localizedSymbol: reading.symbol,
});
