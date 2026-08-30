/**
 * Arms the opt-in Hermes startup profiler and the view-manager probe. Must stay
 * the SECOND require of the bundle (after `./startupClock`), because
 * `instrumentViewManagerConstants()` has to run before anything pulls in
 * BridgelessUIManager, which captures the global it wraps at evaluation time.
 */
import { StartupMark } from '#/native/StartupMark';

import {
  HERMES_PROFILE_STARTUP,
  setStartupProfilerArmed,
} from './startupProfiling';
import { armStartupProfileFallback } from './startupProfileCapture';
import { instrumentViewManagerConstants } from './viewManagerProbe';

if (HERMES_PROFILE_STARTUP) {
  // Record whether sampling ACTUALLY started, not that the build asked for it:
  // a run reporting armed without arming loses `app_fully_drawn_ms` for nothing.
  setStartupProfilerArmed(StartupMark.startProfiling());
  instrumentViewManagerConstants();
  // Bounds the sampler's lifetime so a launch that never reaches an instrumented
  // list still writes a trace and stops perturbing the session.
  armStartupProfileFallback();
}

export {};
