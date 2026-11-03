package dev.souschef.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

/**
 * The device's approximate place. A town is enough, so a place Android already
 * holds answers at once; only with none recent does this ask for a new reading,
 * fused before network. The app holds only the coarse permission, so Android
 * itself keeps the reading approximate. The permission is asked for in JS.
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
    if (!allowed) {
      promise.reject(UNAVAILABLE, "Not allowed")
      return
    }
    if (manager == null || !LocationManagerCompat.isLocationEnabled(manager)) {
      promise.reject(UNAVAILABLE, "Location is off")
      return
    }
    val recent = heldPlace(manager, RECENT_MILLIS)
    if (recent != null) {
      promise.resolve(placeOf(recent))
      return
    }
    val source = readingSource(manager)
    if (source == null) {
      settleWithHeld(manager, promise, FAILED, "No provider is enabled")
      return
    }
    read(manager, source, promise)
  }

  private fun read(manager: LocationManager, source: String, promise: Promise) {
    val context = reactApplicationContext
    val mainThread = Handler(Looper.getMainLooper())
    val cancel = CancellationSignal()
    // The reading and the time limit race on the main thread: the first wins.
    var settled = false
    val giveUp = Runnable {
      if (!settled) {
        settled = true
        cancel.cancel()
        settleWithHeld(manager, promise, TIMEOUT, "Tried $source")
      }
    }
    mainThread.postDelayed(giveUp, READING_MILLIS)
    try {
      LocationManagerCompat.getCurrentLocation(
        manager,
        source,
        cancel,
        ContextCompat.getMainExecutor(context),
      ) { location ->
        if (!settled) {
          settled = true
          mainThread.removeCallbacks(giveUp)
          if (location == null) {
            settleWithHeld(manager, promise, FAILED, "Tried $source")
          } else {
            promise.resolve(placeOf(location))
          }
        }
      }
    } catch (error: SecurityException) {
      // Revoked between the check and the read.
      settled = true
      mainThread.removeCallbacks(giveUp)
      promise.reject(UNAVAILABLE, error.message, error)
    }
  }

  private fun settleWithHeld(
    manager: LocationManager,
    promise: Promise,
    code: String,
    tried: String,
  ) {
    val held = heldPlace(manager, DAY_MILLIS)
    if (held != null) {
      promise.resolve(placeOf(held))
    } else {
      promise.reject(code, tried)
    }
  }

  private fun readingSource(manager: LocationManager): String? = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      manager.isProviderEnabled(LocationManager.FUSED_PROVIDER) ->
      LocationManager.FUSED_PROVIDER
    manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
      LocationManager.NETWORK_PROVIDER
    else -> null
  }

  /** The newest place any provider holds, no older than `maxAgeMillis`. */
  private fun heldPlace(manager: LocationManager, maxAgeMillis: Long): Location? =
    manager.allProviders
      .mapNotNull { provider -> lastKnown(manager, provider) }
      .filter { ageMillis(it) <= maxAgeMillis }
      .maxByOrNull { it.elapsedRealtimeNanos }

  // The coarse permission does not reach every provider on every Android.
  private fun lastKnown(manager: LocationManager, provider: String): Location? =
    try {
      manager.getLastKnownLocation(provider)
    } catch (_: SecurityException) {
      null
    } catch (_: IllegalArgumentException) {
      null
    }

  private fun ageMillis(location: Location): Long =
    TimeUnit.NANOSECONDS.toMillis(
      SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos,
    )

  private fun placeOf(location: Location) =
    Arguments.createMap().apply {
      putDouble("lat", location.latitude)
      putDouble("lng", location.longitude)
      putDouble("accuracyMeters", location.accuracy.toDouble())
    }

  companion object {
    const val NAME = "ApproximateLocationModule"
    private const val UNAVAILABLE = "location_unavailable"
    private const val FAILED = "location_failed"
    private const val TIMEOUT = "location_timeout"
    private const val READING_MILLIS = 10_000L
    private val RECENT_MILLIS = TimeUnit.MINUTES.toMillis(10)
    private val DAY_MILLIS = TimeUnit.HOURS.toMillis(24)
  }
}
