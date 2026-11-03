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
 * The device's approximate place, in the parts `findPlace` (JS) orders: a place
 * Android already holds, and one new reading, fused before network, that can be
 * given up. The app holds only the coarse permission, so Android itself keeps
 * the reading approximate. The permission is asked for in JS.
 */
class ApproximateLocationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private class Reading(val promise: Promise, val cancel: CancellationSignal, val source: String)

  // Touched on the main thread only, where the reading also answers.
  private var pending: Reading? = null
  private val mainThread = Handler(Looper.getMainLooper())

  override fun getName(): String = NAME

  /** The newest place any provider holds, or null when older than `maxAgeMillis`. */
  @ReactMethod
  fun heldPosition(maxAgeMillis: Double, promise: Promise) {
    mainThread.post {
      val manager = usableManager(promise) ?: return@post
      promise.resolve(heldPlace(manager, maxAgeMillis.toLong())?.let { placeOf(it) })
    }
  }

  /** One new reading; `cancelRead` gives it up. */
  @ReactMethod
  fun readPosition(promise: Promise) {
    mainThread.post {
      if (pending != null) {
        promise.reject(BUSY, "A reading is already under way")
        return@post
      }
      val manager = usableManager(promise) ?: return@post
      val source = readingSource(manager)
      if (source == null) {
        promise.reject(FAILED, "No provider is enabled")
        return@post
      }
      val reading = Reading(promise, CancellationSignal(), source)
      pending = reading
      try {
        LocationManagerCompat.getCurrentLocation(
          manager,
          source,
          reading.cancel,
          ContextCompat.getMainExecutor(reactApplicationContext),
        ) { location ->
          settle(reading) {
            if (location == null) {
              it.reject(FAILED, "Tried $source")
            } else {
              it.resolve(placeOf(location))
            }
          }
        }
      } catch (error: SecurityException) {
        // Revoked between the check and the read.
        settle(reading) { it.reject(UNAVAILABLE, error.message, error) }
      }
    }
  }

  /** Gives up the reading under way, as timed out; nothing when none is. */
  @ReactMethod
  fun cancelRead() {
    mainThread.post {
      val reading = pending ?: return@post
      reading.cancel.cancel()
      settle(reading) { it.reject(TIMEOUT, "Tried ${reading.source}") }
    }
  }

  private fun settle(reading: Reading, answer: (Promise) -> Unit) {
    if (pending !== reading) return
    pending = null
    answer(reading.promise)
  }

  private fun usableManager(promise: Promise): LocationManager? {
    val context = reactApplicationContext
    val allowed = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    return when {
      !allowed -> {
        promise.reject(UNAVAILABLE, "Not allowed")
        null
      }
      manager == null || !LocationManagerCompat.isLocationEnabled(manager) -> {
        promise.reject(UNAVAILABLE, "Location is off")
        null
      }
      else -> manager
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
    private const val BUSY = "location_busy"
  }
}
