/** A country code as its name in the reader's language, else the code. */
export function formatCountryName(code: string, language: string): string {
  try {
    return (
      new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
