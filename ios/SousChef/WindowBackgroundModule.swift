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
    apply(theme == "dark" ? .dark : .light)
  }

  @objc func followSystem() {
    apply(.unspecified)
  }

  private func apply(_ style: UIUserInterfaceStyle) {
    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else { return }
      window.overrideUserInterfaceStyle = style
      window.rootViewController?.overrideUserInterfaceStyle = style
      window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
    }
  }
}
