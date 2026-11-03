import CoreLocation
import React

/// The device's approximate place, in the parts `findPlace` (JS) orders: a place
/// Core Location already holds, and one new reading that can be given up. It
/// asks for reduced accuracy only, and `NSLocationDefaultAccuracyReduced` keeps
/// the system prompt from offering more. Permission is asked for in JS.
@objc(ApproximateLocationModule)
class ApproximateLocationModule: NSObject, CLLocationManagerDelegate {

  private var manager: CLLocationManager?
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// The place Core Location holds, or null when it is older than `maxAgeMillis`.
  @objc func heldPosition(
    _ maxAgeMillis: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Core Location calls back on the thread that made the manager.
    DispatchQueue.main.async {
      guard CLLocationManager.locationServicesEnabled() else {
        reject("location_unavailable", "Location is off", nil)
        return
      }
      guard let location = CLLocationManager().location,
        -location.timestamp.timeIntervalSinceNow * 1000 <= maxAgeMillis
      else {
        resolve(nil)
        return
      }
      resolve(Self.place(of: location))
    }
  }

  /// One new reading; `cancelRead` gives it up.
  @objc func readPosition(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      if self.resolve != nil {
        reject("location_busy", "A reading is already under way", nil)
        return
      }
      guard CLLocationManager.locationServicesEnabled() else {
        reject("location_unavailable", "Location is off", nil)
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

  /// Gives up the reading under way, as timed out; nothing when none is.
  @objc func cancelRead() {
    DispatchQueue.main.async {
      self.settle { _, reject in
        reject("location_timeout", "Tried Core Location", nil)
      }
    }
  }

  func locationManager(
    _ manager: CLLocationManager,
    didUpdateLocations locations: [CLLocation]
  ) {
    guard let location = locations.last else { return }
    settle { resolve, _ in resolve(Self.place(of: location)) }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    settle { _, reject in
      reject("location_failed", error.localizedDescription, nil)
    }
  }

  private static func place(of location: CLLocation) -> [String: Double] {
    [
      "lat": location.coordinate.latitude,
      "lng": location.coordinate.longitude,
      "accuracyMeters": location.horizontalAccuracy,
    ]
  }

  /// Answers the one pending reading and lets the manager go.
  private func settle(_ answer: (RCTPromiseResolveBlock, RCTPromiseRejectBlock) -> Void) {
    guard let resolve = resolve, let reject = reject else { return }
    self.resolve = nil
    self.reject = nil
    manager?.delegate = nil
    manager = nil
    answer(resolve, reject)
  }
}
