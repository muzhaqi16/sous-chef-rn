/**
 * A unit or reading as the documents select it, labelled as an abbreviation
 * reads in every language: its short form is its symbol, singular and plural.
 * A test of a localized or plural label states those fields itself.
 */
export const asAbbreviation = <const T extends { symbol: string }>(
  unit: T,
): T & {
  localizedSymbolForms: {
    __typename: 'PluralForms';
    one: T['symbol'];
    other: T['symbol'];
  };
} => ({
  ...unit,
  localizedSymbolForms: {
    __typename: 'PluralForms',
    one: unit.symbol,
    other: unit.symbol,
  },
});

/** A reading's short form agrees with its own value. */
export const readingAsAbbreviation = <const T extends { symbol: string }>(
  reading: T,
): T & { localizedSymbol: T['symbol'] } => ({
  ...reading,
  localizedSymbol: reading.symbol,
});
