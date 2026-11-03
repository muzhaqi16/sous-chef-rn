'use strict';
/**
 * Drops the console a test file buffered when every test in it passed, so
 * output reaches the terminal only beside a failure. Reporters share one
 * result object and run in list order, so `jest.config.js` lists this one
 * before `default`. A single-file run prints its console live, unaffected.
 */
class QuietPassingFiles {
  onTestResult(_test, result) {
    if (result.numFailingTests === 0 && !result.testExecError) {
      result.console = undefined;
    }
  }
}

module.exports = QuietPassingFiles;
