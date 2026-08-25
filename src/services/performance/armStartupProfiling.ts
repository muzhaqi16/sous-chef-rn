/**
 * Arms the opt-in Hermes startup profiler and the view-manager probe.
 *
 * Imported by `index.js` immediately after `./startupClock`, and for the same
 * reason it is a module rather than a statement: Metro hoists every `require`
 * above all top-level statements, so the `if (HERMES_PROFILE_STARTUP)` block
 * this replaced ran only after `react-native-performance`, `./src/i18n/config`,
 * `./src/apollo/config` and `./src/theme/unistyles` had all evaluated.
 *
 * `instrumentViewManagerConstants()` has to run before anything pulls in
 * BridgelessUIManager, which captures the global this wraps into a module-scope
 * const at evaluation time. Being the second require — after a clock module
 * with no imports — is what actually delivers that; source position in
 * `index.js` never did.
 *
 * This module's own imports evaluate before its body, which is why the clock
 * cannot live here: its origin would land after them.
 */
import { StartupMark } from '#/native/StartupMark';

import {
  HERMES_PROFILE_STARTUP,
  setStartupProfilerArmed,
} from './startupProfiling';
import { armStartupProfileFallback } from './startupProfileCapture';
import { instrumentViewManagerConstants } from './viewManagerProbe';

if (HERMES_PROFILE_STARTUP) {
  // Record whether sampling ACTUALLY started, not that the build asked for it.
  // The flag is platform-agnostic build config, and a run that reports armed
  // without arming loses `app_fully_drawn_ms` to the suppression branch and
  // gets no trace in exchange.
  setStartupProfilerArmed(StartupMark.startProfiling());
  instrumentViewManagerConstants();
  // Bounds the sampler's lifetime here, next to where it starts, so a launch
  // that never reaches an instrumented list still writes a trace and stops
  // perturbing the session.
  armStartupProfileFallback();
}

export {};
