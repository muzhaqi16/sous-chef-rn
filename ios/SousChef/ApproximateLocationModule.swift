import CoreLocation
import React

/// The device's approximate place. A town is enough, so a place Core Location
/// already holds answers at once; only with none recent does this ask for a new
/// reading, giving up after 10 seconds. It asks for reduced accuracy only, and
/// `NSLocationDefaultAccuracyReduced` keeps the system prompt from offering
/// more. Permission is asked for in JS.
@objc(ApproximateLocationModule)
class ApproximateLocationModule: NSObject, CLLocationManagerDelegate {

  private static let recentSeconds: TimeInterval = 10 * 60
  private static let daySeconds: TimeInterval = 24 * 60 * 60
  private static let readingSeconds: TimeInterval = 10

  private var manager: CLLocationManager?
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?
  private var giveUp: DispatchWorkItem?

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
      guard CLLocationManager.locationServicesEnabled() else {
        reject("location_unavailable", "Location is off", nil)
        return
      }
      let manager = CLLocationManager()
      if let held = self.held(by: manager, within: Self.recentSeconds) {
        resolve(Self.place(of: held))
        return
      }
      manager.delegate = self
      manager.desiredAccuracy = kCLLocationAccuracyReduced
      self.manager = manager
      self.resolve = resolve
      self.reject = reject
      let giveUp = DispatchWorkItem { [weak self] in
        self?.settleWithHeld(code: "location_timeout", message: "Tried Core Location")
      }
      self.giveUp = giveUp
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.readingSeconds, execute: giveUp)
      manager.requestLocation()
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
    settleWithHeld(code: "location_failed", message: error.localizedDescription)
  }

  private func settleWithHeld(code: String, message: String) {
    let held = manager.flatMap { self.held(by: $0, within: Self.daySeconds) }
    settle { resolve, reject in
      if let held = held {
        resolve(Self.place(of: held))
      } else {
        reject(code, message, nil)
      }
    }
  }

  private func held(by manager: CLLocationManager, within seconds: TimeInterval) -> CLLocation? {
    guard let location = manager.location,
      -location.timestamp.timeIntervalSinceNow <= seconds
    else { return nil }
    return location
  }

  private static func place(of location: CLLocation) -> [String: Double] {
    [
      "lat": location.coordinate.latitude,
      "lng": location.coordinate.longitude,
      "accuracyMeters": location.horizontalAccuracy,
    ]
  }

  /// Answers the one pending call and lets the manager go.
  private func settle(_ answer: (RCTPromiseResolveBlock, RCTPromiseRejectBlock) -> Void) {
    guard let resolve = resolve, let reject = reject else { return }
    self.resolve = nil
    self.reject = nil
    giveUp?.cancel()
    giveUp = nil
    manager?.delegate = nil
    manager = nil
    answer(resolve, reject)
  }
}
