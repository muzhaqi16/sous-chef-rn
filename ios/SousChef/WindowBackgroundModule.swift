import UIKit
import React

@objc(WindowBackgroundModule)
class WindowBackgroundModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  private static func keyWindow() -> UIWindow? {
    return UIApplication.shared
      .connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  @objc func setTheme(_ theme: String) {
    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else { return }
      let style: UIUserInterfaceStyle = theme == "dark" ? .dark : .light
      window.overrideUserInterfaceStyle = style
      window.rootViewController?.overrideUserInterfaceStyle = style
      window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
    }
  }
}
