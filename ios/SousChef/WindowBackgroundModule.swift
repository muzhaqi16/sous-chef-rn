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

  @objc func setThemeAndBackground(_ theme: String, hex: String) {
    NSLog("[SousChef:WindowBG] setThemeAndBackground called — theme=%@, hex=%@", theme, hex)
    // Persist for next cold start — AppDelegate reads this synchronously
    UserDefaults.standard.set(theme, forKey: "sous_chef_theme")
    NSLog("[SousChef:WindowBG] persisted theme=%@ to UserDefaults", theme)

    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else {
        NSLog("[SousChef:WindowBG] ERROR: keyWindow is nil!")
        return
      }
      let style: UIUserInterfaceStyle = theme == "dark" ? .dark : .light
      window.overrideUserInterfaceStyle = style
      window.rootViewController?.overrideUserInterfaceStyle = style
      window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
      NSLog("[SousChef:WindowBG] set overrideUserInterfaceStyle=%@", theme)

      let color = Self.color(fromHex: hex)
      window.backgroundColor = color
      if let rootView = window.rootViewController?.view {
        rootView.backgroundColor = color
        NSLog("[SousChef:WindowBG] set bg on window + rootView")
      } else {
        NSLog("[SousChef:WindowBG] WARNING: rootViewController.view is nil")
      }
    }
  }

  @objc func setBackgroundColor(_ hex: String) {
    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else { return }

      let color = Self.color(fromHex: hex)
      window.backgroundColor = color
      if let rootView = window.rootViewController?.view {
        rootView.backgroundColor = color
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
