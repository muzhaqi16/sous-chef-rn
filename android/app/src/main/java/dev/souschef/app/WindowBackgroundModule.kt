package dev.souschef.app

import android.graphics.Color
import android.os.Build
import androidx.core.view.WindowCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Points the navigation bar's buttons at the app's theme rather than the
 * system's. React Native's `StatusBar` covers the status bar only, and its
 * edge-to-edge setup reads the system theme once, at launch.
 */
class WindowBackgroundModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @Suppress("DEPRECATION")
  @ReactMethod
  fun setTheme(theme: String) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window
      // Edge-to-edge paints a scrim below API 29. Button colour is settable from
      // API 27 only, so below that the scrim stays to keep the buttons legible.
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
          window.isNavigationBarContrastEnforced = false
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 ->
          window.navigationBarColor = Color.TRANSPARENT
      }
      WindowCompat.getInsetsController(window, window.decorView)
        .isAppearanceLightNavigationBars = theme != "dark"
    }
  }

  companion object {
    const val NAME = "WindowBackgroundModule"
  }
}
