/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/config/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
      // Increase timeout for slower physical devices
      testTimeout: 180000, // 3 minutes per test
      // Retry failed tests once automatically
      retryTimes: 1,
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
          log: {
            enabled: true,
            keepOnlyFailedTestsArtifacts: true,
          },
          screenshot: {
            enabled: true,
            shouldTakeAutomaticSnapshots: true,
            takeWhen: {
              testStart: false,
              testDone: true,
            },
            keepOnlyFailedTestsArtifacts: true,
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
