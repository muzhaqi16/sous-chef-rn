// The most pages the API reads. Android's scanner stops at it; iOS's takes any
// number, so the text of later shots continues the last page sent.
export const MAX_PAGES = 10;

/** A scan's pages as the API reads them: the text past the last page joins it. */
export const capPages = (pages: string[]) =>
  pages.length <= MAX_PAGES
    ? pages
    : [...pages.slice(0, MAX_PAGES - 1), pages.slice(MAX_PAGES - 1).join('\n')];
