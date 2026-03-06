import UIKit
import React

@objc(WindowBackgroundModule)
class WindowBackgroundModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func setBackgroundColor(_ hex: String) {
    DispatchQueue.main.async {
      guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
            let window = appDelegate.window else { return }

      let color = Self.color(fromHex: hex)
      window.backgroundColor = color
      if let rootView = window.rootViewController?.view {
        rootView.backgroundColor = color
        // Also set background on the React surface view (direct subview of rootVC's view)
        // which gets recreated on JS reload with a default white background
        for subview in rootView.subviews {
          subview.backgroundColor = color
        }
      }
    }
  }

  private static func color(fromHex hex: String) -> UIColor {
    var hexStr = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if hexStr.hasPrefix("#") { hexStr.removeFirst() }
    var rgb: UInt64 = 0
    Scanner(string: hexStr).scanHexInt64(&rgb)
    return UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }
}
