package dev.souschef.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Point
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * On-device text recognition with ML Kit through Google Play services (the model
 * is not bundled in the APK); the Android half of `src/native/TextRecognition.ts`.
 */
class TextRecognitionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  // A reload builds a new module, so this one's thread would otherwise stay
  // parked for the life of the process. `shutdown`, not `shutdownNow`: a read
  // in flight still finishes and deletes its pages.
  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  /**
   * Reads every page, then deletes the pages and any page an earlier scan left
   * behind. A failed read keeps its pages: the caller sends them ([preparePhotos])
   * or deletes them ([deletePhotos]).
   */
  @ReactMethod
  fun recognizeAndDelete(imageUris: ReadableArray, promise: Promise) {
    val uris = uriList(imageUris)
    if (ocrCrashesHere()) {
      promise.reject("text_recognition_unsupported", "On-device text recognition crashes this emulator")
      return
    }
    executor.execute {
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val pages = Arguments.createArray()
        for (uri in uris) pages.pushMap(recognize(recognizer, uri))
        deleteFiles(uris)
        sweepLeftovers()
        promise.resolve(pages)
      } catch (error: Exception) {
        promise.reject("text_recognition_failed", error.message, error)
      } finally {
        recognizer.close()
      }
    }
  }

  /**
   * Each page as an upright JPEG of at most [PHOTO_EDGE] px with no metadata,
   * for the server to read: it refuses one over 4000 px and reads at 2048.
   * Anything written is deleted on a failure; the pages are deleted too unless
   * [keepPages], which leaves them for [recognizeAndDelete]. The executor runs
   * calls in order, so a scan's photos are prepared before its pages are read.
   */
  @ReactMethod
  fun preparePhotos(imageUris: ReadableArray, keepPages: Boolean, promise: Promise) {
    val uris = uriList(imageUris)
    executor.execute {
      val written = mutableListOf<File>()
      try {
        for (uri in uris) written += prepare(uri)
        handedOut += written.map { it.absolutePath }
        promise.resolve(Arguments.createArray().apply { written.forEach { pushMap(describe(it)) } })
      } catch (error: Exception) {
        written.forEach { it.delete() }
        promise.reject("photo_preparation_failed", error.message, error)
      } finally {
        if (!keepPages) deleteFiles(uris)
      }
    }
  }

  @ReactMethod
  fun deletePhotos(imageUris: ReadableArray, promise: Promise) {
    deleteFiles(uriList(imageUris))
    promise.resolve(null)
  }

  private fun describe(photo: File): WritableMap =
    Arguments.createMap().apply {
      putString("uri", Uri.fromFile(photo).toString())
      putDouble("fileSize", photo.length().toDouble())
    }

  private fun uriList(imageUris: ReadableArray): List<Uri> =
    (0 until imageUris.size()).mapNotNull { imageUris.getString(it) }.map(Uri::parse)

  private fun prepare(uri: Uri): File {
    val upright = decodeUpright(uri, PHOTO_EDGE)
    val photo = File(reactApplicationContext.cacheDir, "$PHOTO_PREFIX${UUID.randomUUID()}.jpg")
    try {
      FileOutputStream(photo).use { upright.compress(Bitmap.CompressFormat.JPEG, 80, it) }
    } finally {
      upright.recycle()
    }
    return photo
  }

  /**
   * The page turned upright by its EXIF orientation (a camera photo can lie on
   * its side), at most [maxEdge] px along its longest side when given. The
   * caller recycles it: a full page is tens of MB of native memory.
   */
  private fun decodeUpright(uri: Uri, maxEdge: Int?): Bitmap {
    val resolver = reactApplicationContext.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    require(longest > 0) { "Not an image" }
    // Decode at the coarsest power-of-two step that still covers maxEdge, then scale exactly.
    var sample = 1
    if (maxEdge != null) while (longest / (sample * 2) >= maxEdge) sample *= 2
    val decoded =
      resolver.openInputStream(uri).use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
      } ?: throw IllegalArgumentException("Not an image")
    val orientation =
      resolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } ?: ExifInterface.ORIENTATION_NORMAL
    val degrees =
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
    val scale = if (maxEdge == null) 1f else minOf(1f, maxEdge.toFloat() / maxOf(decoded.width, decoded.height))
    if (scale == 1f && degrees == 0f) return decoded
    val matrix = Matrix().apply {
      postScale(scale, scale)
      postRotate(degrees)
    }
    val upright = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (upright !== decoded) decoded.recycle()
    return upright
  }

  // Play services' text model dies with SIGILL on the arm64 emulator, killing
  // the app (docs/verified-library-behaviour.md); a rejection lets JS fall back.
  private fun ocrCrashesHere(): Boolean =
    Build.HARDWARE == "ranchu" && Build.SUPPORTED_ABIS.firstOrNull() == "arm64-v8a"

  private fun deleteFiles(uris: List<Uri>) {
    for (uri in uris) {
      val path = uri.path?.takeIf { uri.scheme == "file" } ?: continue
      File(path).delete()
      handedOut -= File(path).absolutePath
    }
  }

  // A scan the app was killed during leaves its pages in the ML Kit scanner's
  // cache folder, and a photo left unsent stays in the cache; they go with the
  // next read. Photos still going up are not leftovers.
  private fun sweepLeftovers() {
    val cache = reactApplicationContext.cacheDir
    File(cache, "mlkit_docscan_ui_client").listFiles()?.forEach { it.delete() }
    cache
      .listFiles { file -> file.name.startsWith(PHOTO_PREFIX) && file.absolutePath !in handedOut }
      ?.forEach { it.delete() }
  }

  private fun recognize(
    recognizer: TextRecognizer,
    uri: Uri,
  ): WritableMap {
    val page = decodeUpright(uri, null)
    try {
      val text = Tasks.await(recognizer.process(InputImage.fromBitmap(page, 0)))
      // The boxes normalize by the upright page's own size.
      val width = page.width.toDouble()
      val height = page.height.toDouble()
      val lines = Arguments.createArray()
      for (block in text.textBlocks) {
        for (line in block.lines) {
          val box = line.boundingBox ?: continue
          lines.pushMap(
            Arguments.createMap().apply {
              putString("text", line.text)
              putDouble("x", box.left / width)
              putDouble("y", box.top / height)
              putDouble("width", box.width() / width)
              putDouble("height", box.height() / height)
              slopeOf(line.cornerPoints, width, height)?.let { putDouble("slope", it) }
            },
          )
        }
      }
      return Arguments.createMap().apply { putArray("lines", lines) }
    } finally {
      page.recycle()
    }
  }

  // The rise of the line's top edge per unit across, in page fractions, down
  // positive: a tilted photo's rows are read along it (assembleReceiptLines.ts).
  private fun slopeOf(corners: Array<Point>?, width: Double, height: Double): Double? {
    val topLeft = corners?.getOrNull(0) ?: return null
    val topRight = corners.getOrNull(1) ?: return null
    val run = (topRight.x - topLeft.x) / width
    if (run <= 0) return null
    return (topRight.y - topLeft.y) / height / run
  }

  companion object {
    const val NAME = "TextRecognitionModule"
    private const val PHOTO_EDGE = 2048
    private const val PHOTO_PREFIX = "RECEIPT_PHOTO_"

    // Photos still with JS (going up) are not leftovers, until [deletePhotos].
    private val handedOut: MutableSet<String> = ConcurrentHashMap.newKeySet()
  }
}
