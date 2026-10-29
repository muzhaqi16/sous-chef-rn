import UIKit
import StoreKit
import React

/// StoreKit's rating prompt. StoreKit decides whether it appears (at most three
/// times a year, never in TestFlight) and says nothing either way.
@objc(ReviewPromptModule)
class ReviewPromptModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func requestReview() {
    DispatchQueue.main.async {
      guard
        let scene = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first(where: { $0.activationState == .foregroundActive })
      else { return }
      if #available(iOS 16.0, *) {
        AppStore.requestReview(in: scene)
      } else {
        SKStoreReviewController.requestReview(in: scene)
      }
    }
  }
}
