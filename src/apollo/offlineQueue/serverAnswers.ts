let lastCleanAt = 0;

/** A response with no errors in it: the server is up, whatever a write met. */
export const noteCleanAnswer = (): void => {
  lastCleanAt = Date.now();
};

export const lastCleanAnswerAt = (): number => lastCleanAt;
