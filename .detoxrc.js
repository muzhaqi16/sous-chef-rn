/**
 * Failures must report fast enough to act on.
 *
 * The previous defaults made a failure take minutes: `retryTimes: 1` ran every
 * failing test a second time, and `testTimeout: 180000` meant a genuinely stuck
 * test burned three minutes per attempt — six with the retry. A directory of
 * nine failing tests took five minutes to say anything, which is long enough
 * that you stop watching, and long enough that the natural response is to run
 * fewer tests rather than fix them.
 *
 * Those numbers were for slow physical devices and for absorbing device
 * flakiness in CI. Both are real, so they are still available — but behind
 * `E2E_SLOW=1` rather than paid for on every local run. The slowest passing
 * test in the suite is ~10s, so 60s is still four times the headroom it needs.
 */
const SLOW = process.env.E2E_SLOW === '1';

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/config/jest.config.js',
      // `bail` belongs in jest.config.js, NOT here: detox serialises a numeric
      // arg as `--bail 1`, and jest then reads the `1` as a test PATH PATTERN.
      // `detox test … smoke.e2e.ts` silently became
      // `Ran all test suites matching /1|e2e\/tests\/smoke.e2e.ts/` and ran
      // unrelated suites.
    },
    jest: {
      setupTimeout: 120000,
      testTimeout: SLOW ? 180000 : 60000,
      retryTimes: SLOW ? 1 : 0,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/SousChef.app',
      build:
        'xcodebuild -workspace ios/SousChefRN.xcworkspace -scheme SousChefRN -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/SousChef.app',
      build:
        'xcodebuild -workspace ios/SousChefRN.xcworkspace -scheme SousChefRN -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath:
        'android/app/build/outputs/apk/release/app-universal-release.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd android && ./gradlew assembleRelease :app:assembleDebugAndroidTest',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 17',
      },
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*', // Matches any attached device
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_9a',
      },
      // Boot emulator automatically if not running
      bootArgs: '-no-snapshot-save',
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
      behavior: {
        init: {
          reinstallApp: false,
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          shutdownDevice: false,
        },
      },
      artifacts: {
        rootDir: 'e2e/artifacts/ios-simulator',
        plugins: {
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: false,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: true,
            takeWhen: {
              testStart: false,
              testDone: true,
            },
            keepOnlyFailedTestsArtifacts: false,
          },
          video: {
            enabled: false,
          },
        },
      },
      session: {
        autoStart: true,
        debugSynchronization: 10000,
        server: 'ws://localhost:8099',
        sessionId: 'sous-chef-e2e-ios',
      },
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
      behavior: {
        init: {
          reinstallApp: false,
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          shutdownDevice: false,
        },
      },
      artifacts: {
        rootDir: 'e2e/artifacts/ios-simulator-release',
        plugins: {
          // Kept on a PASS, unlike a normal release run. This configuration is
          // the measuring one (`E2E_TELEMETRY=1 npm run test:e2e:release`), and
          // a measuring run that succeeds is exactly the run whose log and
          // screenshots are wanted — the log is where the token-injection vs
          // UI-login fallback is visible, which decides whether the sample is
          // a clean signed-in cold start or has a login flow inside it.
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: false,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: true,
            takeWhen: {
              testStart: false,
              testDone: true,
            },
            keepOnlyFailedTestsArtifacts: false,
          },
          video: {
            enabled: false,
          },
        },
      },
      session: {
        autoStart: true,
        debugSynchronization: 10000,
        server: 'ws://localhost:8099',
        sessionId: 'sous-chef-e2e-ios-release',
      },
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug',
      // ⭐ OPTIMIZED FOR ANDROID DEVICE WITH APP REUSE
      behavior: {
        init: {
          // Don't reinstall app (for app reuse)
          reinstallApp: false,
          // Keep app data between test runs
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          // Don't uninstall after tests (for app reuse)
          shutdownDevice: false,
        },
      },
      artifacts: {
        // Record artifacts only on test failure
        rootDir: 'e2e/artifacts/android-device',
        plugins: {
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: false, // Manual only
            takeWhen: {
              testStart: false,
              testDone: false,
              testFailure: true, // On failure only
            },
            keepOnlyFailedTestsArtifacts: true,
          },
          video: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
            android: {
              bitRate: 4000000, // Optimize quality/size
              size: '1080x1920',
            },
          },
        },
      },
      session: {
        // Detox session configuration for stability
        autoStart: true,
        debugSynchronization: 10000, // Log if waiting >10s
        server: 'ws://localhost:8099',
        sessionId: 'sous-chef-e2e',
      },
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release',
      behavior: {
        init: {
          reinstallApp: false,
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          shutdownDevice: false,
        },
      },
      artifacts: {
        rootDir: 'e2e/artifacts/android-device-release',
        plugins: {
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: false,
            takeWhen: {
              testFailure: true,
            },
            keepOnlyFailedTestsArtifacts: true,
          },
          video: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
            android: {
              bitRate: 4000000,
              size: '1080x1920',
            },
          },
        },
      },
    },
    'android.emu.debug': {
      // Use whatever emulator/device is attached (adbName '.*') rather than a
      // hardcoded AVD — works with any running device.
      device: 'attached',
      app: 'android.debug',
      behavior: {
        init: {
          reinstallApp: true, // Emulator can reinstall faster
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          shutdownDevice: false,
        },
      },
      artifacts: {
        rootDir: 'e2e/artifacts/android-emulator',
        plugins: {
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: false,
            takeWhen: {
              testFailure: true,
            },
            keepOnlyFailedTestsArtifacts: true,
          },
          video: {
            enabled: false, // Disable for emulator (slower)
          },
        },
      },
    },
    'android.emu.release': {
      // Any attached device/emulator (see android.emu.debug).
      device: 'attached',
      app: 'android.release',
      behavior: {
        init: {
          reinstallApp: true,
          launchApp: true,
        },
        launchApp: 'auto',
        cleanup: {
          shutdownDevice: false,
        },
      },
      artifacts: {
        rootDir: 'e2e/artifacts/android-emulator-release',
        plugins: {
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: false,
            takeWhen: {
              testFailure: true,
            },
            keepOnlyFailedTestsArtifacts: true,
          },
          video: {
            enabled: false,
          },
        },
      },
    },
  },
  // Global settings for all configurations
  logger: {
    level: 'info', // trace | debug | info | warn | error
    overrideConsole: false,
    options: {
      showLoggerName: true,
      showTimestamp: true,
      useUTC: false,
    },
  },
};
