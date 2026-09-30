// A word of two letters or more, and an amount such as `3.48` or `3,48`.
const ITEM_LINE = /[A-Za-z]{2,}.*\d+[.,]\d{2}(?!\d)/;

/** Whether any line could be an item: too little text means a retake, not an empty review. */
export const hasItemLines = (pages: readonly (readonly string[])[]): boolean =>
  pages.some(page => page.some(line => ITEM_LINE.test(line)));
