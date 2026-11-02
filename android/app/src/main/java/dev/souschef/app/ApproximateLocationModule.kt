package dev.souschef.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The device's approximate place, read once per call from the network
 * provider, else (Android 12 and up) the fused one. The app holds only the
 * coarse permission, so Android itself keeps the reading approximate. The
 * permission is asked for in JS.
 */
class ApproximateLocationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getCurrentPosition(promise: Promise) {
    val context = reactApplicationContext
    val allowed = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    val provider = when {
      manager == null -> null
      manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
        LocationManager.NETWORK_PROVIDER
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        manager.isProviderEnabled(LocationManager.FUSED_PROVIDER) ->
        LocationManager.FUSED_PROVIDER
      else -> null
    }
    if (!allowed || manager == null || provider == null) {
      promise.reject("location_unavailable", "Location is off or not allowed")
      return
    }
    try {
      LocationManagerCompat.getCurrentLocation(
        manager,
        provider,
        null as CancellationSignal?,
        ContextCompat.getMainExecutor(context),
      ) { location ->
        if (location == null) {
          promise.reject("location_failed", "The device could not say where it is")
        } else {
          promise.resolve(
            Arguments.createMap().apply {
              putDouble("lat", location.latitude)
              putDouble("lng", location.longitude)
              putDouble("accuracyMeters", location.accuracy.toDouble())
            },
          )
        }
      }
    } catch (error: SecurityException) {
      // Revoked between the check and the read.
      promise.reject("location_unavailable", error.message, error)
    }
  }

  companion object {
    const val NAME = "ApproximateLocationModule"
  }
}
