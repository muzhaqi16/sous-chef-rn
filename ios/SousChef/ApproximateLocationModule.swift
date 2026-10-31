import CoreLocation
import React

/// The device's approximate place, read once per call. It asks Core Location
/// for reduced accuracy only, and `NSLocationDefaultAccuracyReduced` keeps the
/// system prompt from offering more. Permission is asked for in JS.
@objc(ApproximateLocationModule)
class ApproximateLocationModule: NSObject, CLLocationManagerDelegate {

  private var manager: CLLocationManager?
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func getCurrentPosition(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Core Location calls back on the thread that made the manager.
    DispatchQueue.main.async {
      if self.resolve != nil {
        reject("location_busy", "A reading is already under way", nil)
        return
      }
      let manager = CLLocationManager()
      manager.delegate = self
      manager.desiredAccuracy = kCLLocationAccuracyReduced
      self.manager = manager
      self.resolve = resolve
      self.reject = reject
      manager.requestLocation()
    }
  }

  func locationManager(
    _ manager: CLLocationManager,
    didUpdateLocations locations: [CLLocation]
  ) {
    guard let location = locations.last else { return }
    settle { resolve, _ in
      resolve([
        "lat": location.coordinate.latitude,
        "lng": location.coordinate.longitude,
        "accuracyMeters": location.horizontalAccuracy,
      ])
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    settle { _, reject in
      reject("location_failed", error.localizedDescription, error)
    }
  }

  /// Answers the one pending call and lets the manager go.
  private func settle(_ answer: (RCTPromiseResolveBlock, RCTPromiseRejectBlock) -> Void) {
    guard let resolve = resolve, let reject = reject else { return }
    self.resolve = nil
    self.reject = nil
    manager?.delegate = nil
    manager = nil
    answer(resolve, reject)
  }
}
